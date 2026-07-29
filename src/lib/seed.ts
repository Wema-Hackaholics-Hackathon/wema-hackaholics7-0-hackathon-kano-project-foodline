import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import {
  bankTransactions,
  customers,
  debitAttempts,
  inflowEvents,
  installments,
  ledgerEvents,
  loans,
  mandates,
  orderItems,
  orders,
  productUnits,
  products,
  retailers,
  salaryDetections,
  sessions,
  settings,
  settlements,
  users,
  webhookEvents,
} from "@/db/schema";
import { uid, voucherCode, randomToken, monoReference } from "./ids";
import { addDays, addMonthsClamped, daysInMonth, todayLagos } from "./dates";
import { DEFAULT_CONFIG } from "./settings";
import { logEvent } from "./ledger";
import { assignLimit, runSalaryVerification } from "./onboarding";
import { buildSchedule } from "./underwriting";
import { createTransferRecipient } from "./paystack";

// One-command demo readiness: POST /api/dev/seed. Deterministic data, and the
// demo customer goes through the REAL verification pipeline so the ledger
// carries genuine decisions.

// Precomputed PBKDF2 hashes (100k iterations) so seeding stays cheap on-Worker.
const HASHES = {
  admin:
    "pbkdf2$100000$290a16591e2512758e3067b19c8c1f15$d4fa0ad18657000858b71f3a957cd147b773121876a3f6cd3c4696e5b81c2751",
  retailer:
    "pbkdf2$100000$fbc1eee6bcd9a686c731e52e9b6d411c$bdd62df294277e41d5b9419ea29fb05ace8b7321b3034b2e7f800bd0f678e385",
  demo: "pbkdf2$100000$447ab7fcbdf0763df7477f0b87d7caec$cdf21084e9ef7cb49bad160ca2f7c25a04c67e452e919054e72edf1194685906",
};

export const SEED_LOGINS = {
  admin: { email: "admin@foodline.com.ng", password: "Foodline-Admin-2026" },
  retailer: { email: "retailer@foodline.com.ng", password: "Foodline-Retail-2026" },
  customer: { email: "adaeze@demo.foodline.com.ng", password: "Foodline-Demo-2026" },
};

// Deterministic PRNG so every fresh deploy seeds identical data
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

type ProductSeed = {
  slug: string;
  name: string;
  description: string;
  category: string;
  units: { label: string; priceNaira: number; stock: number }[];
};

const CATALOG: ProductSeed[] = [
  { slug: "rice-foreign", name: "Parboiled Rice (Foreign)", category: "Grains & Rice", description: "Stone-free long grain parboiled rice that cooks fluffy and separate. The everyday choice for jollof, fried rice and white rice.", units: [ { label: "1 mudu", priceNaira: 2800, stock: 400 }, { label: "1 paint bucket", priceNaira: 8200, stock: 150 }, { label: "25kg half bag", priceNaira: 47500, stock: 60 }, { label: "50kg bag", priceNaira: 92000, stock: 35 } ] },
  { slug: "rice-ofada", name: "Ofada Rice (Local)", category: "Grains & Rice", description: "Aromatic unpolished local rice with that unmistakable ofada flavour. Best served with ayamase sauce.", units: [ { label: "1 mudu", priceNaira: 3200, stock: 200 }, { label: "1 paint bucket", priceNaira: 9500, stock: 80 }, { label: "10kg bag", priceNaira: 21000, stock: 40 } ] },
  { slug: "beans-oloyin", name: "Honey Beans (Oloyin)", category: "Beans & Legumes", description: "Sweet oloyin beans that soften quickly and taste rich. Perfect for porridge, akara and moi moi.", units: [ { label: "1 mudu", priceNaira: 3600, stock: 300 }, { label: "1 paint bucket", priceNaira: 10500, stock: 100 }, { label: "25kg half bag", priceNaira: 52000, stock: 30 } ] },
  { slug: "garri-ijebu", name: "Ijebu Garri (White)", category: "Garri & Flours", description: "Crisp, pleasantly sour white garri that drinks well and swells generously for eba.", units: [ { label: "1 mudu", priceNaira: 1400, stock: 500 }, { label: "1 paint bucket", priceNaira: 4200, stock: 200 }, { label: "50kg bag", priceNaira: 38000, stock: 40 } ] },
  { slug: "garri-yellow", name: "Yellow Garri", category: "Garri & Flours", description: "Rich yellow garri fried with palm oil. Smooth texture for eba with extra body and colour.", units: [ { label: "1 mudu", priceNaira: 1600, stock: 400 }, { label: "1 paint bucket", priceNaira: 4800, stock: 150 } ] },
  { slug: "semovita", name: "Semovita", category: "Garri & Flours", description: "Fine wheat semolina that turns silky-smooth on the fire. A steady favourite for swallow.", units: [ { label: "1kg pack", priceNaira: 2100, stock: 250 }, { label: "5kg bag", priceNaira: 9800, stock: 120 }, { label: "10kg bag", priceNaira: 18900, stock: 60 } ] },
  { slug: "yam", name: "Puna Yam", category: "Tubers & Roots", description: "Firm white puna yam tubers from Benue. Boil, pound or fry; they hold their taste.", units: [ { label: "1 medium tuber", priceNaira: 4500, stock: 180 }, { label: "3 tubers", priceNaira: 12800, stock: 70 }, { label: "5 tubers", priceNaira: 20500, stock: 40 } ] },
  { slug: "sweet-potato", name: "Sweet Potatoes", category: "Tubers & Roots", description: "Orange-flesh sweet potatoes, naturally sugary and quick to cook. Great fried or boiled.", units: [ { label: "1kg", priceNaira: 1200, stock: 300 }, { label: "small basket", priceNaira: 5500, stock: 80 } ] },
  { slug: "palm-oil", name: "Palm Oil (Undiluted)", category: "Oils & Sauces", description: "Thick, deep-red undiluted palm oil straight from the mill. The soul of banga, egusi and native stews.", units: [ { label: "1 litre", priceNaira: 4200, stock: 200 }, { label: "4 litres", priceNaira: 15800, stock: 90 }, { label: "10 litres", priceNaira: 38500, stock: 40 } ] },
  { slug: "vegetable-oil", name: "Vegetable Oil", category: "Oils & Sauces", description: "Clear, cholesterol-free vegetable oil for frying and everyday cooking. Light taste, no foam.", units: [ { label: "1 litre", priceNaira: 5200, stock: 220 }, { label: "4 litres", priceNaira: 19500, stock: 100 } ] },
  { slug: "tomatoes", name: "Fresh Tomatoes", category: "Vegetables & Peppers", description: "Firm, red Jos tomatoes picked this week. Blend for stew or slice for salad.", units: [ { label: "1 paint bucket", priceNaira: 7500, stock: 120 }, { label: "small basket", priceNaira: 18500, stock: 50 }, { label: "big basket", priceNaira: 46000, stock: 20 } ] },
  { slug: "tomato-paste", name: "Tomato Paste (210g tin)", category: "Oils & Sauces", description: "Double-concentrated tomato paste with deep colour and no sour aftertaste.", units: [ { label: "1 tin", priceNaira: 1150, stock: 600 }, { label: "carton (24 tins)", priceNaira: 26000, stock: 45 } ] },
  { slug: "pepper", name: "Atarodo (Scotch Bonnet)", category: "Vegetables & Peppers", description: "Fiery fresh atarodo with full aroma. The heat that makes the stew.", units: [ { label: "1 paint bucket", priceNaira: 6800, stock: 100 }, { label: "small bag", priceNaira: 16500, stock: 35 } ] },
  { slug: "onions", name: "Red Onions", category: "Vegetables & Peppers", description: "Dry northern red onions with tight skins that keep for weeks.", units: [ { label: "1kg", priceNaira: 1800, stock: 350 }, { label: "small bag", priceNaira: 14500, stock: 60 }, { label: "half bag", priceNaira: 26000, stock: 30 } ] },
  { slug: "titus-fish", name: "Titus Fish (Frozen)", category: "Protein & Fish", description: "Plump frozen titus (mackerel) with firm flesh. Cleaned and ready for the pot or grill.", units: [ { label: "1kg", priceNaira: 5500, stock: 200 }, { label: "half carton", priceNaira: 28500, stock: 40 }, { label: "full carton", priceNaira: 55000, stock: 20 } ] },
  { slug: "stockfish", name: "Stockfish (Okporoko)", category: "Protein & Fish", description: "Well-dried Norwegian stockfish with that deep okporoko flavour soups deserve.", units: [ { label: "1 head", priceNaira: 6500, stock: 90 }, { label: "1kg pieces", priceNaira: 18500, stock: 45 } ] },
  { slug: "crayfish", name: "Dried Crayfish", category: "Soup Essentials", description: "Clean, well-sieved crayfish, ground-ready. One spoon changes the whole pot.", units: [ { label: "1 congo", priceNaira: 8500, stock: 120 }, { label: "1 paint bucket", priceNaira: 24000, stock: 40 } ] },
  { slug: "egusi", name: "Egusi (Melon Seeds)", category: "Soup Essentials", description: "Shelled white egusi seeds, fresh and oily. Grinds into a rich, thick soup base.", units: [ { label: "1 congo", priceNaira: 7200, stock: 150 }, { label: "1 paint bucket", priceNaira: 20500, stock: 50 } ] },
  { slug: "ogbono", name: "Ogbono Seeds", category: "Soup Essentials", description: "Premium ogbono that draws beautifully. Sorted by hand, no shells.", units: [ { label: "1 milk cup", priceNaira: 2500, stock: 200 }, { label: "1 congo", priceNaira: 9800, stock: 60 } ] },
  { slug: "chicken", name: "Frozen Whole Chicken", category: "Protein & Fish", description: "Soft-agric whole chicken, cleaned and flash-frozen. Tender enough for grilling, tough enough for stew.", units: [ { label: "1kg cut pieces", priceNaira: 4800, stock: 250 }, { label: "whole bird (approx 1.5kg)", priceNaira: 7500, stock: 100 }, { label: "carton (10kg)", priceNaira: 68000, stock: 25 } ] },
  { slug: "eggs", name: "Eggs (Crate of 30)", category: "Protein & Fish", description: "Farm-fresh medium eggs delivered within 48 hours of lay.", units: [ { label: "1 crate", priceNaira: 6200, stock: 300 }, { label: "2 crates", priceNaira: 12000, stock: 140 } ] },
  { slug: "spaghetti", name: "Spaghetti (500g)", category: "Pantry & Extras", description: "Durum wheat spaghetti that stays firm, never soggy. Weeknight jollof spaghetti sorted.", units: [ { label: "1 pack", priceNaira: 1350, stock: 500 }, { label: "carton (20 packs)", priceNaira: 25500, stock: 60 } ] },
  { slug: "indomie", name: "Instant Noodles", category: "Pantry & Extras", description: "The lunchbox classic. Quick, filling and always in demand.", units: [ { label: "1 pack", priceNaira: 450, stock: 1000 }, { label: "carton (40 packs)", priceNaira: 16800, stock: 80 } ] },
  { slug: "sugar", name: "Granulated Sugar", category: "Pantry & Extras", description: "Clean white granulated sugar, dry and free-flowing.", units: [ { label: "1kg pack", priceNaira: 2400, stock: 300 }, { label: "10kg bag", priceNaira: 22500, stock: 70 } ] },
  { slug: "milo", name: "Chocolate Malt Drink (Refill)", category: "Pantry & Extras", description: "Chocolate malt beverage refill pack for the family breakfast table.", units: [ { label: "500g refill", priceNaira: 4300, stock: 200 }, { label: "900g refill", priceNaira: 7600, stock: 100 } ] },
];

/** Most recent occurrence of `day` on or before today */
function lastPayDate(day: number): string {
  const today = todayLagos();
  const [y, m, d] = today.split("-").map(Number);
  if (d >= day) {
    return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(day, daysInMonth(y, m))).padStart(2, "0")}`;
  }
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}-${String(Math.min(day, daysInMonth(py, pm))).padStart(2, "0")}`;
}

async function wipe(db: Db) {
  // children before parents
  await db.delete(debitAttempts);
  await db.delete(installments);
  await db.delete(loans);
  await db.delete(orderItems);
  await db.delete(settlements);
  await db.delete(orders);
  await db.delete(inflowEvents);
  await db.delete(salaryDetections);
  await db.delete(bankTransactions);
  await db.delete(mandates);
  await db.delete(productUnits);
  await db.delete(products);
  await db.delete(customers);
  await db.delete(retailers);
  await db.delete(sessions);
  await db.delete(ledgerEvents);
  await db.delete(webhookEvents);
  await db.delete(users);
  await db.delete(settings);
}

export async function runSeed(db: Db, origin: string): Promise<Record<string, unknown>> {
  await wipe(db);
  const now = new Date();
  const rand = lcg(20260728);

  // Lending config
  await db.insert(settings).values({
    key: "lending_config",
    value: DEFAULT_CONFIG,
    updatedAt: now,
    updatedBy: "seed",
  });

  // Image manifest (produced by the image pipeline; static assets)
  let manifest: Record<string, string> = {};
  try {
    const res = await fetch(`${origin}/products/manifest.json`);
    if (res.ok) manifest = (await res.json()) as Record<string, string>;
  } catch {
    // fall back to conventional paths below
  }

  // --- Catalog -------------------------------------------------------------
  let unitCount = 0;
  for (const p of CATALOG) {
    const productId = uid();
    await db.insert(products).values({
      id: productId,
      name: p.name,
      description: p.description,
      category: p.category,
      imageKey: manifest[p.slug] ?? `/products/${p.slug}.jpg`,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    for (let i = 0; i < p.units.length; i++) {
      const u = p.units[i];
      await db.insert(productUnits).values({
        id: uid(),
        productId,
        unitLabel: u.label,
        priceKobo: u.priceNaira * 100,
        stockQty: u.stock,
        active: true,
        sortOrder: i,
      });
      unitCount++;
    }
  }

  // --- Admin ---------------------------------------------------------------
  const adminId = uid();
  await db.insert(users).values({
    id: adminId,
    role: "admin",
    name: "Foodline Operations",
    email: SEED_LOGINS.admin.email,
    phone: "+2348000000001",
    passwordHash: HASHES.admin,
    createdAt: now,
  });

  // --- Partner store network ----------------------------------------------
  // Coordinates are pre-resolved so a fresh seed never waits on Google, and
  // so the nearest-store ranking is identical on every deploy. The signed-in
  // demo retailer sits closest to the demo customer's home address.
  const STORES = [
    {
      login: true,
      owner: "Nkechi Eze",
      email: SEED_LOGINS.retailer.email,
      phone: "+2348000000002",
      businessName: "Mama Nkechi Provisions",
      address: "Shop 14, Mile 12 Market, Ketu, Lagos",
      lat: 6.6015,
      lng: 3.3969,
      geoLabel: "Mile 12, Lagos",
      accountNumber: "0000000000",
      bankCode: "057",
      bankName: "Zenith Bank",
    },
    {
      owner: "Segun Adebayo",
      email: "ikeja@demo.foodline.com.ng",
      phone: "+2348000000003",
      businessName: "Alausa Food Hub",
      address: "22 Awolowo Way, Ikeja, Lagos",
      lat: 6.6018,
      lng: 3.3515,
      geoLabel: "Ikeja, Lagos",
      accountNumber: "0000000000",
      bankCode: "057",
      bankName: "Zenith Bank",
    },
    {
      owner: "Bisi Coker",
      email: "surulere@demo.foodline.com.ng",
      phone: "+2348000000004",
      businessName: "Coker Foodstuff Stores",
      address: "8 Ojuelegba Road, Surulere, Lagos",
      lat: 6.4969,
      lng: 3.3481,
      geoLabel: "Surulere, Lagos",
      accountNumber: "0000000000",
      bankCode: "057",
      bankName: "Zenith Bank",
    },
    {
      owner: "Ifeoma Nwachukwu",
      email: "lekki@demo.foodline.com.ng",
      phone: "+2348000000005",
      businessName: "Lekki Fresh Market",
      address: "5 Admiralty Way, Lekki Phase 1, Lagos",
      lat: 6.4478,
      lng: 3.4723,
      geoLabel: "Lekki, Lagos",
      accountNumber: "0000000000",
      bankCode: "057",
      bankName: "Zenith Bank",
    },
    {
      owner: "Musa Bello",
      email: "alaba@demo.foodline.com.ng",
      phone: "+2348000000006",
      businessName: "Alaba Provisions Depot",
      address: "Block C, Alaba International Market, Ojo, Lagos",
      lat: 6.4561,
      lng: 3.1858,
      geoLabel: "Alaba, Lagos",
      accountNumber: "0000000000",
      bankCode: "057",
      bankName: "Zenith Bank",
    },
  ];

  let retailerId = "";
  let recipientCode: string | null = null;
  for (const store of STORES) {
    const id = uid();
    if (store.login) retailerId = id;
    await db.insert(users).values({
      id,
      role: "retailer",
      name: store.owner,
      email: store.email,
      phone: store.phone,
      passwordHash: HASHES.retailer,
      createdAt: now,
    });
    // Paystack test recipient; harmless if it fails, since demo retailers
    // fall back to a simulated settlement rather than stalling the pitch
    let code: string | null = null;
    try {
      code = await createTransferRecipient({
        name: store.businessName,
        accountNumber: store.accountNumber,
        bankCode: store.bankCode,
      });
    } catch {
      code = null;
    }
    if (store.login) recipientCode = code;
    await db.insert(retailers).values({
      id,
      businessName: store.businessName,
      contactPhone: store.phone,
      address: store.address,
      lat: store.lat,
      lng: store.lng,
      geoLabel: store.geoLabel,
      settlementBankCode: store.bankCode,
      settlementBankName: store.bankName,
      settlementAccountNumber: store.accountNumber,
      settlementAccountName: store.businessName.toUpperCase(),
      paystackRecipientCode: code,
      active: true,
      isDemo: true,
      createdAt: now,
    });
  }

  // --- Demo customer: Adaeze, via the real pipeline ------------------------
  const payDay = 26;
  const salaryKobo = 28_500_000; // ₦285,000
  const customerId = uid();
  await db.insert(users).values({
    id: customerId,
    role: "customer",
    name: "Adaeze Okafor",
    email: SEED_LOGINS.customer.email,
    phone: "+2348012345678",
    passwordHash: HASHES.demo,
    createdAt: now,
  });
  await db.insert(customers).values({
    id: customerId,
    bvn: "22212345678",
    dob: "1994-03-14",
    employerName: "Sterling Consult Ltd",
    workEmail: "adaeze.okafor@sterlingconsult.ng",
    address: "15 Demurin Street, Ketu, Lagos",
    // Pre-resolved so the checkout store picker never waits on geocoding
    lat: 6.5883,
    lng: 3.3806,
    geoLabel: "Ketu, Lagos",
    stage: "verify_salary",
    monoAccountId: null,
    accountName: "ADAEZE CHIAMAKA OKAFOR",
    accountNumber: "0131883461",
    bankName: "ALAT by WEMA",
    bankCode: "035",
    dataStatus: "AVAILABLE",
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  });

  // Six months of realistic history: salary + rent + market runs + airtime
  const txRows: (typeof bankTransactions.$inferInsert)[] = [];
  const anchor = lastPayDate(payDay);
  let runningBalance = 41_35_000; // arbitrary starting kobo balance tail
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  for (let back = 5; back >= 0; back--) {
    const pay = addMonthsClamped(anchor, -back);
    const [py, pm] = pay.split("-").map(Number);
    const jitter = [0, 0, 250_000, 0, -150_000, 0][back]; // within tolerance
    const amount = salaryKobo + jitter;
    runningBalance += amount;
    txRows.push({
      id: uid(),
      customerId,
      monoTxId: `seed-sal-${back}`,
      narration: `SALARY/STERLING CONSULT LTD/${monthNames[pm - 1]} ${py}`,
      amountKobo: amount,
      type: "credit",
      balanceKobo: runningBalance,
      date: `${pay}T07:42:00.000Z`,
      category: "salary",
    });
    // Rent (quarterly), bills and spending noise
    const spends: { day: number; amt: number; label: string }[] = [
      { day: 1, amt: 2_000_00, label: "AIRTIME TOPUP MTN" },
      { day: 3, amt: 18_500_00, label: "POS/SHOPRITE LEKKI" },
      { day: 6, amt: 9_200_00, label: "TRANSFER TO CHIOMA OKAFOR/UBA" },
      { day: 9, amt: 12_400_00, label: "POS/MILE 12 MARKET" },
      { day: 13, amt: 15_000_00, label: "NEPA/EKEDC PREPAID" },
      { day: 17, amt: 7_800_00, label: "POS/MEDPLUS PHARMACY" },
      { day: 21, amt: 24_000_00, label: "TRANSFER/BOLT TRIPS" },
    ];
    for (const s of spends) {
      const d = addDays(pay, s.day);
      const wobble = Math.round(s.amt * (0.85 + rand() * 0.3));
      runningBalance -= wobble;
      txRows.push({
        id: uid(),
        customerId,
        monoTxId: `seed-sp-${back}-${s.day}`,
        narration: s.label,
        amountKobo: wobble,
        type: "debit",
        balanceKobo: runningBalance,
        date: `${d}T${String(9 + (s.day % 9)).padStart(2, "0")}:15:00.000Z`,
        category: "spend",
      });
    }
    if (back % 3 === 0) {
      const d = addDays(pay, 2);
      runningBalance -= 95_000_00;
      txRows.push({
        id: uid(),
        customerId,
        monoTxId: `seed-rent-${back}`,
        narration: "RENT/QTR LANDMARK ESTATES",
        amountKobo: 95_000_00,
        type: "debit",
        balanceKobo: runningBalance,
        date: `${d}T10:05:00.000Z`,
        category: "rent",
      });
    }
    // occasional non-salary credit (must NOT confuse detection)
    if (back === 2 || back === 4) {
      const d = addDays(pay, 11);
      runningBalance += 15_000_00;
      txRows.push({
        id: uid(),
        customerId,
        monoTxId: `seed-cr-${back}`,
        narration: "TRANSFER FROM CHIOMA OKAFOR/UBA",
        amountKobo: 15_000_00,
        type: "credit",
        balanceKobo: runningBalance,
        date: `${d}T16:20:00.000Z`,
        category: "transfer",
      });
    }
  }
  for (let i = 0; i < txRows.length; i += 10) {
    await db.insert(bankTransactions).values(txRows.slice(i, i + 10));
  }

  // Real pipeline: detection -> confirm -> limit
  const detection = await runSalaryVerification(db, customerId);
  if (!detection.eligible) {
    throw new Error(
      `Seed integrity failure: demo customer not eligible (${JSON.stringify(detection.reasons)})`
    );
  }
  const limitKobo = await assignLimit(db, customerId);

  // Approved + ready standing mandate (demo: no Mono call)
  const mandateId = uid();
  await db.insert(mandates).values({
    id: mandateId,
    customerId,
    monoMandateId: null,
    reference: monoReference("fmd"),
    status: "approved",
    readyToDebit: true,
    amountCapKobo: Math.round(limitKobo * DEFAULT_CONFIG.mandateCapMultiplier),
    startDate: todayLagos(),
    endDate: addMonthsClamped(todayLagos(), DEFAULT_CONFIG.mandateMonths),
    nibssCode: "RC227914/1580/0009134772",
    accountName: "ADAEZE CHIAMAKA OKAFOR",
    accountNumber: "0131883461",
    bankName: "ALAT by WEMA",
    isDemo: true,
    createdAt: now,
    approvedAt: now,
    readyAt: now,
  });
  await db
    .update(customers)
    .set({ stage: "active", updatedAt: now })
    .where(eq(customers.id, customerId));
  await logEvent(db, {
    type: "demo_action",
    customerId,
    actor: "seed",
    message: "Demo mandate seeded as approved and ready to debit",
  });

  // --- Synthetic portfolio for the ops dashboard ---------------------------
  const names = [
    ["Tunde Bakare", "tunde.bakare"],
    ["Hauwa Suleiman", "hauwa.suleiman"],
    ["Emeka Nwosu", "emeka.nwosu"],
    ["Funmi Adeyemi", "funmi.adeyemi"],
    ["Ibrahim Danjuma", "ibrahim.danjuma"],
    ["Blessing Osagie", "blessing.osagie"],
  ] as const;
  const states: ("active" | "repaid" | "overdue" | "active2")[] = [
    "active",
    "repaid",
    "overdue",
    "active",
    "active2",
    "repaid",
  ];
  const someUnits = await db
    .select({ unit: productUnits, product: products })
    .from(productUnits)
    .innerJoin(products, eq(productUnits.productId, products.id))
    .limit(30);

  for (let i = 0; i < names.length; i++) {
    const [fullName, slug] = names[i];
    const uidC = uid();
    const salary = 18_000_000 + Math.round(rand() * 30_000_000);
    const limit = Math.round((salary * 0.3) / 100_000) * 100_000;
    await db.insert(users).values({
      id: uidC,
      role: "customer",
      name: fullName,
      email: `${slug}@demo.foodline.com.ng`,
      phone: `+23481${String(2000000 + i).padStart(7, "0")}`,
      passwordHash: HASHES.demo,
      createdAt: new Date(now.getTime() - (40 - i * 5) * 86_400_000),
    });
    await db.insert(customers).values({
      id: uidC,
      bvn: `2221000000${i}`,
      dob: "1990-06-15",
      employerName: ["Zenith Metals", "FCMB Plc", "Andela Nigeria", "NNPC Retail", "Dangote Sugar", "Interswitch"][i],
      workEmail: `${slug}@work.ng`,
      stage: "active",
      accountName: fullName.toUpperCase(),
      accountNumber: `01${String(31000000 + i * 7013)}`,
      bankName: ["GTBank", "Access Bank", "Zenith Bank", "UBA", "First Bank", "Kuda Bank"][i],
      bankCode: ["058", "044", "057", "033", "011", "50211"][i],
      dataStatus: "AVAILABLE",
      salaryAmountKobo: salary,
      salaryMonths: 4 + (i % 3),
      salaryDayOfMonth: [25, 26, 27, 28, 24, 26][i],
      salaryEmployerGuess: ["Zenith Metals", "Fcmb", "Andela", "Nnpc Retail", "Dangote Sugar", "Interswitch"][i],
      nextPayDate: addDays(todayLagos(), 5 + i * 3),
      salaryVerifiedAt: new Date(now.getTime() - (35 - i * 4) * 86_400_000),
      creditLimitKobo: limit,
      isDemo: true,
      createdAt: new Date(now.getTime() - (40 - i * 5) * 86_400_000),
      updatedAt: now,
    });
    const mId = uid();
    await db.insert(mandates).values({
      id: mId,
      customerId: uidC,
      reference: monoReference("fmd"),
      status: "approved",
      readyToDebit: true,
      amountCapKobo: Math.round(limit * 1.1),
      startDate: addDays(todayLagos(), -35),
      endDate: addMonthsClamped(todayLagos(), 12),
      nibssCode: `RC227914/1580/000${9200000 + i}`,
      accountName: fullName.toUpperCase(),
      bankName: ["GTBank", "Access Bank", "Zenith Bank", "UBA", "First Bank", "Kuda Bank"][i],
      isDemo: true,
      createdAt: new Date(now.getTime() - (38 - i * 4) * 86_400_000),
      approvedAt: new Date(now.getTime() - (37 - i * 4) * 86_400_000),
      readyAt: new Date(now.getTime() - (37 - i * 4) * 86_400_000),
    });

    // One historic redeemed+settled order with a loan in the target state
    const state = states[i];
    const daysAgo = 8 + i * 4;
    const issuedAt = new Date(now.getTime() - daysAgo * 86_400_000);
    const pick = someUnits.slice((i * 4) % 20, ((i * 4) % 20) + 3);
    const total = pick.reduce((s, r) => s + r.unit.priceKobo, 0);
    const orderId = uid();
    await db.insert(orders).values({
      id: orderId,
      customerId: uidC,
      status: "settled",
      totalKobo: total,
      voucherCode: voucherCode(),
      qrToken: randomToken(24),
      issuedAt,
      expiresAt: new Date(issuedAt.getTime() + 72 * 3_600_000),
      redeemedAt: new Date(issuedAt.getTime() + 5 * 3_600_000),
      redeemedByRetailerId: retailerId,
    });
    for (const r of pick) {
      await db.insert(orderItems).values({
        id: uid(),
        orderId,
        productId: r.product.id,
        productUnitId: r.unit.id,
        productName: r.product.name,
        unitLabel: r.unit.unitLabel,
        unitPriceKobo: r.unit.priceKobo,
        qty: 1,
        lineTotalKobo: r.unit.priceKobo,
      });
    }
    await db.insert(settlements).values({
      id: uid(),
      orderId,
      retailerId,
      amountKobo: total,
      status: "success",
      reference: `flstl-seed-${i}-${randomToken(6)}`,
      paystackTransferCode: `TRF_seed${i}${randomToken(4)}`,
      createdAt: new Date(issuedAt.getTime() + 5 * 3_600_000),
      settledAt: new Date(issuedAt.getTime() + 5 * 3_600_000 + 90_000),
    });

    const n = 2 + (i % 3);
    const marginBps = DEFAULT_CONFIG.installmentPlans.find((p) => p.installments === n)!.marginBps;
    const schedule = buildSchedule(total, marginBps, n, addDays(todayLagos(), 5 + i * 3), [25, 26, 27, 28, 24, 26][i]);
    const loanId = uid();
    const loanStatus = state === "repaid" ? "repaid" : state === "overdue" ? "overdue" : "active";
    await db.insert(loans).values({
      id: loanId,
      customerId: uidC,
      orderId,
      mandateId: mId,
      principalKobo: total,
      marginBps,
      totalRepayableKobo: schedule.totalRepayableKobo,
      installmentsCount: n,
      status: loanStatus,
      createdAt: issuedAt,
      updatedAt: now,
    });
    for (let s = 0; s < schedule.installments.length; s++) {
      const inst = schedule.installments[s];
      let instStatus: "scheduled" | "paid" | "overdue" | "failed" = "scheduled";
      let dueDate = inst.dueDate;
      if (state === "repaid") instStatus = "paid";
      if (state === "active2" && s === 0) instStatus = "paid";
      if (state === "overdue" && s === 0) {
        instStatus = "overdue";
        dueDate = addDays(todayLagos(), -12);
      }
      const instId = uid();
      await db.insert(installments).values({
        id: instId,
        loanId,
        seq: inst.seq,
        dueDate,
        amountKobo: inst.amountKobo,
        status: instStatus,
        paidAt: instStatus === "paid" ? new Date(now.getTime() - (daysAgo - 6) * 86_400_000) : null,
        attempts: instStatus === "paid" ? 1 : instStatus === "overdue" ? 3 : 0,
        lastAttemptAt: instStatus === "overdue" ? new Date(now.getTime() - 2 * 86_400_000) : null,
      });
      if (instStatus === "paid") {
        await db.insert(debitAttempts).values({
          id: uid(),
          installmentId: instId,
          loanId,
          reference: monoReference("fdb"),
          amountKobo: inst.amountKobo,
          status: "successful",
          trigger: "salary_detected",
          responseCode: "00",
          message: "Account debited successfully",
          monoSessionId: `9999992509${1000000 + i * 7 + s}`,
          feeKobo: 55_00,
          createdAt: new Date(now.getTime() - (daysAgo - 6) * 86_400_000),
          resolvedAt: new Date(now.getTime() - (daysAgo - 6) * 86_400_000),
        });
      }
    }
    await logEvent(db, {
      type: "loan_created",
      customerId: uidC,
      orderId,
      loanId,
      actor: "seed",
      message: `Seed portfolio loan for ${fullName}: ${n} installment(s), status ${loanStatus}`,
    });
  }

  return {
    products: CATALOG.length,
    productUnits: unitCount,
    demoCustomer: SEED_LOGINS.customer.email,
    demoRetailer: SEED_LOGINS.retailer.email,
    admin: SEED_LOGINS.admin.email,
    creditLimitKobo: limitKobo,
    paystackRecipientCreated: Boolean(recipientCode),
    portfolioCustomers: names.length,
  };
}
