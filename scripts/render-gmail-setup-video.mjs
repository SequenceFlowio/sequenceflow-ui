/** Regenerate the illustrated, silent NL/EN guides. Requires ffmpeg and sharp (Next's image dependency). */
import sharp from 'sharp';
import { readFile, mkdir, mkdtemp, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const guide = JSON.parse(await readFile(new URL('../lib/email/setup/gmail-app-password.json', import.meta.url), 'utf8'));
const output = new URL('../public/media/setup/', import.meta.url);
await mkdir(output, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'support-setup-video-'));
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const wrap = (text, max) => {
  const lines = [''];
  for (const word of text.split(' ')) {
    if (lines.at(-1).length + word.length + 1 > max) lines.push(word);
    else lines[lines.length - 1] += (lines.at(-1) ? ' ' : '') + word;
  }
  return lines;
};
function frame(step, index, lang) {
  const caption = wrap(step.caption, 91);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#0a0a0a"/>
    <g font-family="Arial, sans-serif">
      <circle cx="76" cy="48" r="12" fill="#c9f76c"/><text x="100" y="56" font-size="22" fill="#f4f4f0">Support One</text>
      <text x="1216" y="54" text-anchor="end" font-size="17" fill="#969c93">GMAIL · ${lang === 'nl' ? 'APP-WACHTWOORD' : 'APP PASSWORD'}</text>
      <text x="64" y="128" font-size="38" font-weight="bold" fill="#f4f4f0">${index + 1}. ${escape(step.title)}</text>
      <text x="64" y="176" font-size="24" fill="#aab0a6">${escape(step.instruction)}</text>
      <rect x="160" y="222" width="960" height="342" rx="22" fill="#131513" stroke="#30382b"/>
      <circle cx="188" cy="253" r="5" fill="#535b4b"/><circle cx="206" cy="253" r="5" fill="#535b4b"/><circle cx="224" cy="253" r="5" fill="#535b4b"/>
      <text x="1088" y="260" text-anchor="end" fill="#aab0a6" font-size="16">${escape(step.screen)}</text>
      <path d="M160 282H1120" stroke="#30382b"/>
      ${step.rows.map((row, i) => `<rect x="200" y="${308 + i * 76}" width="880" height="60" rx="12" fill="${i === step.highlight ? '#26321b' : '#0d0f0c'}" stroke="${i === step.highlight ? '#c9f76c' : '#30382b'}"/><text x="226" y="${346 + i * 76}" fill="${i === step.highlight ? '#c9f76c' : '#ebeee6'}" font-size="24">${escape(row)}</text>${i === step.highlight ? `<circle cx="1046" cy="${338 + i * 76}" r="7" fill="#c9f76c"/>` : ''}`).join('')}
      ${caption.map((line, i) => `<text x="640" y="${610 + i * 31}" text-anchor="middle" fill="#d3d8cd" font-size="22">${escape(line)}</text>`).join('')}
      ${Array.from({length:6}, (_, i) => `<rect x="${64 + i * 194}" y="682" width="182" height="4" rx="2" fill="${i <= index ? '#c9f76c' : '#252a22'}"/>`).join('')}
    </g>
  </svg>`;
}
try {
  for (const lang of ['nl', 'en']) {
    const clips = [];
    for (const [index, step] of guide[lang].steps.entries()) {
      const png = join(temp, `${lang}-${index}.png`);
      const mp4 = join(temp, `${lang}-${index}.mp4`);
      await sharp(Buffer.from(frame(step, index, lang))).png().toFile(png);
      if (index === 0) await copyFile(png, new URL(`gmail-app-password-${lang}.png`, output));
      execFileSync('ffmpeg', ['-v','error','-y','-loop','1','-i',png,'-t','8','-vf','fade=t=in:st=0:d=0.25,fade=t=out:st=7.75:d=0.25','-r','24','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p',mp4]);
      clips.push(mp4);
    }
    const { writeFile } = await import('node:fs/promises');
    const list = join(temp, `${lang}.txt`);
    await writeFile(list, clips.map(p => `file '${p}'`).join('\n'));
    execFileSync('ffmpeg', ['-v','error','-y','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',new URL(`gmail-app-password-${lang}.mp4`, output).pathname]);
  }
} finally {
  await rm(temp, { recursive:true, force:true });
}
