import fs from 'fs';
import { translations } from './src/lib/i18n';

fs.mkdirSync('./src/locales', { recursive: true });

for (const [locale, messages] of Object.entries(translations)) {
    fs.writeFileSync(`./src/locales/${locale}.json`, JSON.stringify(messages, null, 2));
    console.log(`Extracted ${locale}.json`);
}
