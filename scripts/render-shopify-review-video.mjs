/**
 * Renders the English setup walkthrough for the Shopify App Store review
 * (requirement 4.5.3) from real screenshots of the demo store.
 *
 *   node scripts/render-shopify-review-video.mjs <screenshot-dir>
 *
 * The screenshots are not in the repo (they show personal data before masking);
 * `mask` rectangles are blurred before anything is drawn. Needs ffmpeg and sharp.
 */
import sharp from 'sharp';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const shots = process.argv[2];
if (!shots) throw new Error('Pass the screenshot directory.');
const output = new URL('../public/media/shopify-review-demo.mp4', import.meta.url).pathname;

const W = 1280, H = 720, BOX = { x: 64, y: 150, w: 1152, h: 486 };
const STEPS = [
  { title: 'SequenceFlow Support — setup walkthrough', instruction: 'From install to a sent reply, on a fresh development store.', seconds: 6,
    rows: ['Install and choose a plan', 'Connect Gmail with Google sign-in (send-only)', 'Add your knowledge and signature', 'A customer email arrives: review the draft with the order next to it', 'Approve & send from your own address'] },
  { shot: '01-install.jpg', title: 'Install the app', instruction: 'Approve read access to orders and customers.', crop: [540, 60, 590, 570], focus: [1053, 584, 60, 30],
    caption: 'Support One only reads order data to answer customer emails. It never changes your store.' },
  { shot: '02-welcome.jpg', title: 'Choose how to start', instruction: "New merchants click 'No, start fresh'.", crop: [250, 70, 680, 590], focus: [490, 582, 148, 46],
    caption: "Already using Support One on our website? 'Yes, link my account' connects this store to that workspace." },
  { shot: '03-plans.jpg', title: 'Pick a plan', instruction: 'The plan selection opens automatically after setup.', crop: [470, 70, 750, 390], focus: [501, 357, 200, 33],
    caption: 'Every plan starts with a 7-day free trial. On development stores the charge is free to test.' },
  { shot: '04-approve.jpg', title: 'Approve the subscription', instruction: 'Billing runs through the Shopify invoice.', crop: [280, 50, 1130, 390], focus: [1099, 158, 280, 28],
    caption: 'After approving you return to the app with the trial active.' },
  { shot: '05-overview.jpg', title: 'Follow the setup checklist', instruction: 'The Overview shows what is still to do.', crop: [260, 220, 1170, 420], focus: [1254, 363, 140, 37],
    caption: "Shopify is connected automatically. Next: connect the support mailbox with 'Connect mailbox'." },
  { shot: '06-mailbox.jpg', title: 'Connect Gmail without a password', instruction: "Click 'Sign in with Google'.", crop: [270, 350, 1150, 350], focus: [310, 593, 180, 40],
    caption: 'Support One only asks permission to send email from your address. It cannot read your inbox.' },
  { shot: '07-google-account.jpg', title: 'Choose your support Gmail account', instruction: 'Google opens in a new window.', crop: [190, 100, 1100, 450], focus: [758, 232, 476, 58],
    mask: [[755, 296, 480, 62]], caption: 'Pick the address your customers email.' },
  { shot: '09-google-consent.jpg', title: 'Allow sending on your behalf', instruction: "Google shows the verified app name 'Support One'. Click Continue.", crop: [190, 70, 1100, 520], focus: [1003, 495, 230, 40],
    caption: 'Access is send-only (gmail.send). You can revoke it any time in your Google Account.' },
  { shot: '10-connected.jpg', title: 'Mailbox connected — now turn on forwarding', instruction: 'Replies are sent from your own Gmail address.', crop: [290, 130, 1100, 500], focus: [310, 398, 1066, 64],
    caption: "Copy the forwarding address. In Gmail: Settings › Forwarding › Add a forwarding address, paste it, choose 'Forward a copy'. Support One confirms Gmail's request automatically." },
  { shot: '11-knowledge-add.jpg', title: 'Add your knowledge', instruction: 'Upload your return and shipping policy (PDF, TXT, Markdown or CSV).', crop: [500, 200, 690, 370], focus: [522, 303, 642, 94],
    caption: 'Drafts follow your own policies, not generic answers.' },
  { shot: '11b-knowledge-test.jpg', title: 'Check what Support One knows', instruction: 'Ask a customer question and see which passage it uses.', crop: [300, 250, 1090, 480], focus: [332, 525, 1022, 190],
    caption: 'Here the uploaded policy answers “How long do I have to return my order?”.' },
  { shot: '12-signature.jpg', title: 'Set your signature', instruction: 'Added under every reply.', crop: [270, 220, 1150, 280], focus: [291, 312, 1104, 110],
    caption: 'Answer style also learns your tone from earlier replies — nothing becomes active without your approval.' },
  { shot: '13-order.jpg', title: 'A customer has an order', instruction: 'For this demo: order #1001, shipped with UPS tracking.', crop: [280, 50, 1110, 500], focus: [291, 186, 760, 148],
    mask: [[1097, 206, 150, 26]], caption: 'Support One finds the order by order number or by the customer’s email address.' },
  { shot: '14-inbox.jpg', title: 'The customer email arrives', instruction: 'Customer questions forwarded from Gmail appear in the Inbox.', crop: [290, 420, 1110, 270], focus: [295, 572, 1096, 102],
    mask: [[312, 586, 40, 40], [360, 590, 90, 20]], caption: 'Each question gets a draft reply, ready for review.' },
  { shot: '15-ticket.jpg', title: 'Review the draft reply', instruction: 'Support One found order #1001 and wrote a draft with its tracking number.', crop: [280, 260, 1120, 440], focus: [848, 537, 522, 150],
    mask: [[292, 346, 36, 40], [334, 344, 145, 44], [313, 511, 80, 18], [864, 553, 88, 22]], caption: 'The order details (item, UPS shipment and tracking) are shown under Available context.' },
  { shot: '16-draft.jpg', title: 'Approve & send', instruction: 'Edit if needed, then click Approve & send.', crop: [280, 40, 1130, 600], focus: [848, 572, 166, 44],
    mask: [[864, 53, 88, 22]], caption: "The reply is sent from your own Gmail address, in the customer's language, with your signature." },
  { shot: '17-sent.jpg', title: 'Reply sent', instruction: 'The conversation moves to Sent.', crop: [280, 250, 1120, 440], focus: [294, 404, 1098, 46],
    mask: [[292, 346, 36, 40], [334, 344, 145, 44], [313, 575, 80, 18], [864, 617, 88, 22]], caption: 'The customer receives the answer in their own inbox, as a normal email reply.' },
  { shot: '18-plan.jpg', title: 'Plan and usage', instruction: 'See your trial and usage, or change plan in Shopify.', crop: [260, 220, 1170, 400], focus: [270, 229, 640, 214],
    caption: 'Questions? support@sequenceflow.io' },
  { title: 'Testing without your own mailbox', instruction: "Overview › 'Create example'", seconds: 8,
    rows: ['Creates a sample question about the latest order in your store', 'Shows the draft reply next to the order details right away', 'The sample comes from a reserved address: it is never sent or billed', 'Create a test order first if the store has none'] },
];

const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const wrap = (text, max) => text.split(' ').reduce((lines, word) => {
  if (lines.at(-1).length + word.length + 1 > max) lines.push(word); else lines[lines.length - 1] += (lines.at(-1) ? ' ' : '') + word;
  return lines;
}, ['']);

async function screen(step) {
  let image = sharp(join(shots, step.shot));
  const meta = await image.metadata();
  const overlays = [];
  for (const [x, y, w, h] of step.mask ?? []) {
    const left = Math.max(0, x), top = Math.max(0, y);
    const width = Math.min(w, meta.width - left), height = Math.min(h, meta.height - top);
    overlays.push({ input: await sharp(join(shots, step.shot)).extract({ left, top, width, height }).blur(9).toBuffer(), left, top });
  }
  if (overlays.length) image = sharp(await image.composite(overlays).toBuffer());
  const [cx, cy, cw, ch] = step.crop;
  const bytes = await image.extract({ left: cx, top: cy, width: Math.min(cw, meta.width - cx), height: Math.min(ch, meta.height - cy) }).png().toBuffer();
  const { width, height } = await sharp(bytes).metadata();
  const scale = Math.min(BOX.w / width, BOX.h / height);
  const w = width * scale, h = height * scale, x = BOX.x + (BOX.w - w) / 2, y = BOX.y + (BOX.h - h) / 2;
  const [fx, fy, fw, fh] = step.focus;
  return `<rect x="${x - 1}" y="${y - 1}" width="${w + 2}" height="${h + 2}" rx="10" fill="none" stroke="#30382b"/>
    <image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${bytes.toString('base64')}"/>
    <rect x="${x + (fx - cx) * scale - 4}" y="${y + (fy - cy) * scale - 4}" width="${fw * scale + 8}" height="${fh * scale + 8}" rx="10" fill="none" stroke="#c9f76c" stroke-width="4"/>`;
}

function card(step) {
  return step.rows.map((row, i) => `<rect x="200" y="${178 + i * 84}" width="880" height="64" rx="14" fill="#0d0f0c" stroke="#30382b"/>
    <circle cx="236" cy="${210 + i * 84}" r="7" fill="#c9f76c"/><text x="262" y="${218 + i * 84}" fill="#ebeee6" font-size="24">${esc(row)}</text>`).join('');
}

async function frame(step, index) {
  const caption = step.caption ? wrap(step.caption, 100) : [];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#0a0a0a"/>
    <g font-family="Arial, Helvetica, sans-serif">
      <circle cx="76" cy="40" r="11" fill="#c9f76c"/><text x="98" y="47" font-size="20" fill="#f4f4f0">Support One</text>
      <text x="1216" y="46" text-anchor="end" font-size="15" fill="#969c93">SHOPIFY APP · SETUP WALKTHROUGH${index && index < STEPS.length - 1 ? ` · STEP ${index} OF ${STEPS.length - 2}` : ''}</text>
      <text x="64" y="98" font-size="32" font-weight="bold" fill="#f4f4f0">${esc(step.title)}</text>
      <text x="64" y="132" font-size="20" fill="#aab0a6">${esc(step.instruction)}</text>
      ${step.shot ? await screen(step) : card(step)}
      ${caption.map((line, i) => `<text x="640" y="${664 + i * 24}" text-anchor="middle" fill="#d3d8cd" font-size="18">${esc(line)}</text>`).join('')}
      ${STEPS.map((_, i) => `<rect x="${64 + i * (1152 / STEPS.length)}" y="708" width="${1152 / STEPS.length - 6}" height="4" rx="2" fill="${i <= index ? '#c9f76c' : '#252a22'}"/>`).join('')}
    </g>
  </svg>`;
}

const temp = await mkdtemp(join(tmpdir(), 'shopify-review-video-'));
try {
  const clips = [];
  for (const [index, step] of STEPS.entries()) {
    const png = join(temp, `${index}.png`), mp4 = join(temp, `${index}.mp4`);
    await sharp(Buffer.from(await frame(step, index))).png().toFile(png);
    // FRAMES_DIR=<dir> keeps the stills, to check masks and highlights.
    if (process.env.FRAMES_DIR) await sharp(png).toFile(join(process.env.FRAMES_DIR, `${String(index).padStart(2, '0')}.png`));
    const seconds = step.seconds ?? 7;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-i', png, '-t', String(seconds), '-vf', `fade=t=in:st=0:d=0.3,fade=t=out:st=${seconds - 0.3}:d=0.3`, '-r', '24', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', mp4]);
    clips.push(mp4);
    if (index === 1) await sharp(png).jpeg({ quality: 85 }).toFile(output.replace(/\.mp4$/, '.jpg'));
  }
  const list = join(temp, 'list.txt');
  await writeFile(list, clips.map(p => `file '${p}'`).join('\n'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', output]);
  console.log('wrote', output);
} finally {
  await rm(temp, { recursive: true, force: true });
}
