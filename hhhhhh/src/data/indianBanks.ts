export interface IndianBank {
  slug: string;
  name: string;
  aliases?: string[];
}

export const INDIAN_BANKS: IndianBank[] = [
  { slug: 'airp', name: 'Airtel Payments Bank', aliases: ['Airtel', 'Airtel Bank'] },
  { slug: 'aubl', name: 'AU Small Finance Bank Limited', aliases: ['AU Small Finance Bank', 'AU Bank', 'AU'] },
  { slug: 'utib', name: 'Axis Bank', aliases: ['Axis', 'Axis Bank Ltd'] },
  { slug: 'bdbl', name: 'Bandhan Bank', aliases: ['Bandhan'] },
  { slug: 'barb', name: 'Bank of Baroda', aliases: ['BOB', 'Baroda', 'Bank of Baroda Ltd'] },
  { slug: 'bkid', name: 'Bank of India', aliases: ['BOI'] },
  { slug: 'mahb', name: 'Bank of Maharashtra', aliases: ['BOM', 'Maharashtra Bank'] },
  { slug: 'cnrb', name: 'Canara Bank', aliases: ['Canara'] },
  { slug: 'cbin', name: 'Central Bank of India', aliases: ['Central Bank', 'CBI'] },
  { slug: 'ciub', name: 'City Union Bank', aliases: ['City Union', 'CUB'] },
  { slug: 'csbk', name: 'CSB Bank Limited', aliases: ['CSB Bank', 'CSB', 'Catholic Syrian Bank'] },
  { slug: 'dcbl', name: 'DCB Bank Limited', aliases: ['DCB Bank', 'DCB'] },
  { slug: 'dlxb', name: 'Dhanalakshmi Bank', aliases: ['Dhanlaxmi Bank', 'Dhanlaxmi', 'Dhanalakshmi'] },
  { slug: 'esmf', name: 'ESAF Small Finance Bank', aliases: ['ESAF Bank', 'ESAF'] },
  { slug: 'fdrl', name: 'Federal Bank', aliases: ['Federal'] },
  { slug: 'fino', name: 'FINO Payments Bank', aliases: ['FINO Bank', 'FINO', 'Fino'] },
  { slug: 'hdfc', name: 'HDFC Bank', aliases: ['HDFC', 'HDFC Bank Ltd'] },
  { slug: 'icic', name: 'ICICI Bank Limited', aliases: ['ICICI Bank', 'ICICI', 'ICICI Bank Ltd'] },
  { slug: 'ibkl', name: 'IDBI Bank', aliases: ['IDBI'] },
  { slug: 'idfb', name: 'IDFC First Bank Limited', aliases: ['IDFC First Bank', 'IDFC First', 'IDFC', 'IDFC Bank'] },
  { slug: 'idib', name: 'Indian Bank', aliases: ['Indian'] },
  { slug: 'ioba', name: 'Indian Overseas Bank', aliases: ['IOB'] },
  { slug: 'indb', name: 'IndusInd Bank', aliases: ['IndusInd', 'Indus Ind'] },
  { slug: 'jaka', name: 'Jammu and Kashmir Bank', aliases: ['J&K Bank', 'Jammu & Kashmir Bank', 'J&K'] },
  { slug: 'jiop', name: 'Jio Payments Bank', aliases: ['Jio Bank', 'Jio Payments', 'Jio'] },
  { slug: 'karb', name: 'Karnataka Bank Limited', aliases: ['Karnataka Bank', 'Karnataka'] },
  { slug: 'kvbl', name: 'Karur Vysya Bank', aliases: ['Karur Vysya', 'KVB'] },
  { slug: 'kkbk', name: 'Kotak Mahindra Bank Limited', aliases: ['Kotak Mahindra Bank', 'Kotak Mahindra', 'Kotak', '811'] },
  { slug: 'pytm', name: 'Paytm Payments Bank', aliases: ['Paytm Bank', 'Paytm', 'Paytm Payments'] },
  { slug: 'psib', name: 'Punjab and Sind Bank', aliases: ['Punjab & Sind Bank', 'Punjab and Sind', 'PSB'] },
  { slug: 'punb', name: 'Punjab National Bank', aliases: ['PNB', 'Punjab National'] },
  { slug: 'ratn', name: 'RBL Bank Limited', aliases: ['RBL Bank', 'RBL', 'Ratnakar Bank'] },
  { slug: 'sibl', name: 'South Indian Bank', aliases: ['South Indian', 'SIB'] },
  { slug: 'scbl', name: 'Standard Chartered Bank', aliases: ['Standard Chartered', 'StanChart', 'SCB'] },
  { slug: 'sbin', name: 'State Bank of India', aliases: ['SBI', 'State Bank', 'SBI Card', 'SBI Bank'] },
  { slug: 'tmbl', name: 'Tamilnad Mercantile Bank Limited', aliases: ['Tamilnad Mercantile Bank', 'TMB'] },
  { slug: 'ntbl', name: 'The Nainital Bank Limited', aliases: ['Nainital Bank', 'Nainital'] },
  { slug: 'ucba', name: 'UCO Bank', aliases: ['UCO'] },
  { slug: 'ujvn', name: 'Ujjivan Small Finance Bank Ltd', aliases: ['Ujjivan Small Finance Bank', 'Ujjivan', 'Ujjivan SFB'] },
  { slug: 'ubin', name: 'Union Bank of India', aliases: ['Union Bank', 'UBI'] },
  { slug: 'yesb', name: 'Yes Bank', aliases: ['YES Bank', 'YES'] },
];

export interface BankAssetInfo {
  slug: string;
  name: string;
  symbolUrl: string;
  symbolPngUrl: string;
  logoUrl: string;
}

export function getBankByName(nameQuery?: string | null): BankAssetInfo | null {
  if (!nameQuery || !nameQuery.trim()) return null;
  const q = nameQuery.toLowerCase().trim();

  // 1. Direct slug match
  const bySlug = INDIAN_BANKS.find((b) => b.slug.toLowerCase() === q);
  if (bySlug) {
    return {
      slug: bySlug.slug,
      name: bySlug.name,
      symbolUrl: `/bank-logos/${bySlug.slug}/symbol.svg`,
      symbolPngUrl: `/bank-logos/${bySlug.slug}/symbol.png`,
      logoUrl: `/bank-logos/${bySlug.slug}/logo.svg`,
    };
  }

  // 2. Exact bank name match
  const exactName = INDIAN_BANKS.find((b) => b.name.toLowerCase() === q);
  if (exactName) {
    return {
      slug: exactName.slug,
      name: exactName.name,
      symbolUrl: `/bank-logos/${exactName.slug}/symbol.svg`,
      symbolPngUrl: `/bank-logos/${exactName.slug}/symbol.png`,
      logoUrl: `/bank-logos/${exactName.slug}/logo.svg`,
    };
  }

  // 3. Alias exact match
  const byAlias = INDIAN_BANKS.find((b) => b.aliases?.some((a) => a.toLowerCase() === q));
  if (byAlias) {
    return {
      slug: byAlias.slug,
      name: byAlias.name,
      symbolUrl: `/bank-logos/${byAlias.slug}/symbol.svg`,
      symbolPngUrl: `/bank-logos/${byAlias.slug}/symbol.png`,
      logoUrl: `/bank-logos/${byAlias.slug}/logo.svg`,
    };
  }

  // 4. Substring / Word boundary match
  for (const b of INDIAN_BANKS) {
    if (q.includes(b.name.toLowerCase())) {
      return {
        slug: b.slug,
        name: b.name,
        symbolUrl: `/bank-logos/${b.slug}/symbol.svg`,
        symbolPngUrl: `/bank-logos/${b.slug}/symbol.png`,
        logoUrl: `/bank-logos/${b.slug}/logo.svg`,
      };
    }
    if (b.aliases) {
      for (const a of b.aliases) {
        const regex = new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(q)) {
          return {
            slug: b.slug,
            name: b.name,
            symbolUrl: `/bank-logos/${b.slug}/symbol.svg`,
            symbolPngUrl: `/bank-logos/${b.slug}/symbol.png`,
            logoUrl: `/bank-logos/${b.slug}/logo.svg`,
          };
        }
      }
    }
  }

  return null;
}

export function getBankForAccount(account?: { bankName?: string; name?: string } | null): BankAssetInfo | null {
  if (!account) return null;
  return getBankByName(account.bankName) || getBankByName(account.name);
}

