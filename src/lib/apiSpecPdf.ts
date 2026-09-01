import { jsPDF } from 'jspdf';
import { UserProfile, Account, Category } from '../types';

interface PdfGeneratorOptions {
  user: UserProfile;
  apiKey: string;
  baseUrl: string;
  accounts?: Account[];
  categories?: Category[];
  appsScriptUrl?: string;
}

export function generateApiSpecsPdf({
  user,
  apiKey,
  baseUrl,
  accounts = [],
  categories = [],
  appsScriptUrl,
}: PdfGeneratorOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const primaryColor = [37, 99, 235]; // #2563eb (Blue)
  const darkColor = [15, 23, 42]; // #0f172a (Slate 900)
  const mutedColor = [100, 116, 139]; // #64748b (Slate 500)
  const codeBgColor = [248, 250, 252]; // #f8fafc (Slate 50)
  const borderLineColor = [226, 232, 240]; // #e2e8f0

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin - 12) {
      doc.addPage();
      cursorY = margin + 8;
      drawHeaderFooter();
    }
  };

  const drawHeaderFooter = () => {
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Top header bar (pages > 1)
      if (i > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
        doc.text('SpendWise REST API Specifications & iOS Shortcuts Guide', margin, 10);
        doc.text(baseUrl, pageWidth - margin, 10, { align: 'right' });
        doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
        doc.setLineWidth(0.2);
        doc.line(margin, 12, pageWidth - margin, 12);
      }

      // Bottom footer bar (all pages)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
      doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.text(`SpendWise Personal Finance • Confidential • Generated for ${user.email}`, margin, pageHeight - 8);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }
  };

  // -------------------------------------------------------------
  // COVER / TITLE BANNER
  // -------------------------------------------------------------
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.roundedRect(margin, cursorY, contentWidth, 34, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('SpendWise API & Integration Specifications', margin + 8, cursorY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(
    `Official REST API Reference, Webhooks & Apple iPhone Shortcuts Automation Guide`,
    margin + 8,
    cursorY + 20
  );

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate 400
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(`Generated for: ${user.name} (${user.email}) • Date: ${dateStr} • Version 1.2.0`, margin + 8, cursorY + 28);

  cursorY += 42;

  // -------------------------------------------------------------
  // SECTION 1: CREDENTIALS & BASE CONFIGURATION
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('1. API Credentials & Authentication', margin, cursorY);
  cursorY += 6;

  // Config Box
  doc.setFillColor(codeBgColor[0], codeBgColor[1], codeBgColor[2]);
  doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
  doc.roundedRect(margin, cursorY, contentWidth, 36, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('API Base URL:', margin + 6, cursorY + 8);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(baseUrl, margin + 35, cursorY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Your API Key:', margin + 6, cursorY + 16);
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(apiKey, margin + 35, cursorY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Auth Headers:', margin + 6, cursorY + 24);
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`x-api-key: ${apiKey}`, margin + 35, cursorY + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text('Or use: Authorization: Bearer <API_KEY>', margin + 35, cursorY + 30);

  cursorY += 44;

  // -------------------------------------------------------------
  // SECTION 2: ENDPOINT SPECIFICATIONS
  // -------------------------------------------------------------
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('2. REST API Endpoints Specification', margin, cursorY);
  cursorY += 6;

  // Endpoint 1: Quick Log / iOS Shortcuts
  checkPageBreak(65);
  doc.setFillColor(239, 246, 255); // Blue 50
  doc.roundedRect(margin, cursorY, contentWidth, 8, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(29, 78, 216); // Blue 700
  doc.text('POST', margin + 4, cursorY + 5.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`${baseUrl}/shortcuts/log`, margin + 20, cursorY + 5.5);
  cursorY += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(
    'Optimized endpoint for Apple iPhone Shortcuts, Siri voice commands, and automated bank SMS triggers.',
    margin,
    cursorY
  );
  cursorY += 5;
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text(
    'Automatically matches accounts by name/number, infers categories using keyword rules, and updates balances.',
    margin,
    cursorY
  );
  cursorY += 6;

  // Payload Box for Endpoint 1
  const ep1ReqJson = JSON.stringify(
    {
      amount: 450,
      title: 'Starbucks Coffee',
      account: accounts[0]?.name || 'HDFC Bank',
      category: 'Food & Dining',
      type: 'expense',
      note: 'Logged via iPhone Shortcut',
    },
    null,
    2
  );

  const ep1ResJson = JSON.stringify(
    {
      success: true,
      message: 'Transaction logged successfully',
      transaction: {
        id: 'tx_9874a1b2',
        title: 'Starbucks Coffee',
        amount: 450,
        type: 'expense',
        account: accounts[0]?.name || 'HDFC Bank',
        category: 'Food & Dining',
        date: '2026-09-01',
      },
    },
    null,
    2
  );

  const reqLines1 = doc.splitTextToSize(ep1ReqJson, (contentWidth - 6) / 2);
  const resLines1 = doc.splitTextToSize(ep1ResJson, (contentWidth - 6) / 2);
  const boxH1 = Math.max(reqLines1.length, resLines1.length) * 3.6 + 12;

  checkPageBreak(boxH1 + 10);
  doc.setFillColor(codeBgColor[0], codeBgColor[1], codeBgColor[2]);
  doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
  doc.roundedRect(margin, cursorY, (contentWidth - 4) / 2, boxH1, 2, 2, 'FD');
  doc.roundedRect(margin + (contentWidth - 4) / 2 + 4, cursorY, (contentWidth - 4) / 2, boxH1, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text('REQUEST JSON BODY', margin + 4, cursorY + 5);
  doc.text('RESPONSE (200 OK)', margin + (contentWidth - 4) / 2 + 8, cursorY + 5);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(reqLines1, margin + 4, cursorY + 10);
  doc.text(resLines1, margin + (contentWidth - 4) / 2 + 8, cursorY + 10);

  cursorY += boxH1 + 10;

  // Endpoint 2: Full Transactions API
  checkPageBreak(65);
  doc.setFillColor(240, 253, 244); // Green 50
  doc.roundedRect(margin, cursorY, contentWidth, 8, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(22, 101, 52); // Green 700
  doc.text('POST', margin + 4, cursorY + 5.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`${baseUrl}/transactions`, margin + 20, cursorY + 5.5);
  cursorY += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Full transaction creation with strict ID mapping, split shares, and transfer routing.', margin, cursorY);
  cursorY += 6;

  // Parameters Table for Endpoint 2
  const params = [
    { name: 'amount', type: 'number', req: 'Required', desc: 'Transaction monetary value' },
    { name: 'title', type: 'string', req: 'Required', desc: 'Merchant or transaction description' },
    { name: 'type', type: 'string', req: 'Optional', desc: '"expense" | "income" | "transfer" (default: expense)' },
    { name: 'accountId', type: 'string', req: 'Optional', desc: 'Target account ID or matching account name' },
    { name: 'categoryId', type: 'string', req: 'Optional', desc: 'Category ID or category name (auto-rules apply)' },
    { name: 'date', type: 'string', req: 'Optional', desc: 'YYYY-MM-DD (defaults to current date)' },
    { name: 'notes', type: 'string', req: 'Optional', desc: 'Optional tags or additional notes' },
  ];

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, cursorY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text('PARAMETER', margin + 4, cursorY + 4.2);
  doc.text('TYPE', margin + 35, cursorY + 4.2);
  doc.text('STATUS', margin + 60, cursorY + 4.2);
  doc.text('DESCRIPTION', margin + 90, cursorY + 4.2);
  cursorY += 6;

  params.forEach((p, idx) => {
    checkPageBreak(7);
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, cursorY, contentWidth, 5.5, 'F');
    }
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(p.name, margin + 4, cursorY + 3.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text(p.type, margin + 35, cursorY + 3.8);

    doc.setFont('helvetica', p.req === 'Required' ? 'bold' : 'normal');
    doc.setTextColor(p.req === 'Required' ? primaryColor[0] : mutedColor[0], p.req === 'Required' ? primaryColor[1] : mutedColor[1], p.req === 'Required' ? primaryColor[2] : mutedColor[2]);
    doc.text(p.req, margin + 60, cursorY + 3.8);

    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(p.desc, margin + 90, cursorY + 3.8);
    cursorY += 5.5;
  });

  cursorY += 8;

  // Endpoint 3: GET Endpoints
  checkPageBreak(50);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, cursorY, contentWidth, 24, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('ADDITIONAL GET ENDPOINTS', margin + 6, cursorY + 6);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`GET ${baseUrl}/accounts`, margin + 6, cursorY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text('Returns array of user accounts with balances and currency info', margin + 68, cursorY + 12);

  doc.setFont('courier', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`GET ${baseUrl}/categories`, margin + 6, cursorY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text('Returns expense & income categories with monthly budget limits', margin + 68, cursorY + 18);

  cursorY += 32;

  // -------------------------------------------------------------
  // SECTION 3: IPHONE SHORTCUTS COMPLETE GUIDE
  // -------------------------------------------------------------
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('3. Apple iPhone Shortcuts Setup Guide (Step-by-Step)', margin, cursorY);
  cursorY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(
    'You can log transactions instantly using Siri voice commands, home screen widgets, or automated bank SMS triggers.',
    margin,
    cursorY
  );
  cursorY += 7;

  const shortcutSteps = [
    {
      step: 'Step 1: Open Apple Shortcuts App',
      details: 'Launch the built-in Shortcuts app on your iPhone or iPad, tap the "+" icon at the top right, and name the shortcut "Log Expense".',
    },
    {
      step: 'Step 2: Add Input Actions',
      details: '1. Add action "Ask for Input" -> Input Type: "Number" -> Prompt: "How much did you spend?"\n2. Add action "Ask for Input" -> Input Type: "Text" -> Prompt: "What was this for? (e.g. Grocery, Uber)"',
    },
    {
      step: 'Step 3: Add "Get Contents of URL" Action',
      details: `1. URL: ${baseUrl}/shortcuts/log\n2. Method: POST\n3. Headers:\n   - x-api-key : ${apiKey}\n   - Content-Type : application/json\n4. Request Body: JSON\n   - amount : (Select Variable -> Provided Number)\n   - title : (Select Variable -> Provided Text)\n   - type : "expense"`,
    },
    {
      step: 'Step 4: Add Confirmation Notification',
      details: 'Add action "Show Notification" -> Text: "Logged in SpendWise: \\(Provided Text) - \\(Provided Number)" or speak confirmation via Siri.',
    },
    {
      step: 'Step 5: Automated Bank SMS Trigger (Optional)',
      details: 'Go to Automation Tab -> New Personal Automation -> When I Receive a Message containing "debited" or "spent" -> Action: Match regular expression for amount -> Run SpendWise POST request automatically without typing!',
    },
  ];

  shortcutSteps.forEach((s) => {
    const textLines = doc.splitTextToSize(s.details, contentWidth - 12);
    const stepHeight = textLines.length * 3.8 + 10;
    checkPageBreak(stepHeight + 2);

    doc.setFillColor(codeBgColor[0], codeBgColor[1], codeBgColor[2]);
    doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
    doc.roundedRect(margin, cursorY, contentWidth, stepHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(s.step, margin + 5, cursorY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(textLines, margin + 5, cursorY + 11);

    cursorY += stepHeight + 4;
  });

  cursorY += 6;

  // -------------------------------------------------------------
  // SECTION 4: CURL & CODE SNIPPETS
  // -------------------------------------------------------------
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('4. Code Examples (cURL & JavaScript)', margin, cursorY);
  cursorY += 6;

  const curlCode = `curl -X POST "${baseUrl}/shortcuts/log" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '{
    "amount": 250,
    "title": "Grocery Shopping",
    "account": "${accounts[0]?.name || 'HDFC Bank'}",
    "category": "Groceries",
    "type": "expense"
  }'`;

  const curlLines = doc.splitTextToSize(curlCode, contentWidth - 10);
  const curlBoxH = curlLines.length * 3.8 + 8;
  checkPageBreak(curlBoxH + 6);

  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.roundedRect(margin, cursorY, contentWidth, curlBoxH, 2, 2, 'F');

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(241, 245, 249);
  doc.text(curlLines, margin + 5, cursorY + 6);

  cursorY += curlBoxH + 10;

  // Final draw header/footers across all pages
  drawHeaderFooter();

  // Trigger browser download
  doc.save(`SpendWise-API-Specifications-${user.name.replace(/\s+/g, '_')}.pdf`);
}
