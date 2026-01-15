import fs from 'node:fs';
import yaml from 'js-yaml';

function extractKeys(obj, prefix = '') {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...extractKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const jaJP = yaml.load(fs.readFileSync('locales/ja-JP.yml', 'utf8'));
const enUS = yaml.load(fs.readFileSync('locales/en-US.yml', 'utf8'));
const koKR = yaml.load(fs.readFileSync('locales/ko-KR.yml', 'utf8'));

const jaKeys = new Set(extractKeys(jaJP));
const enKeys = new Set(extractKeys(enUS));
const koKeys = new Set(extractKeys(koKR));

const jaOnlyVsEn = [...jaKeys].filter(k => !enKeys.has(k));
const jaOnlyVsKo = [...jaKeys].filter(k => !koKeys.has(k));
const koOnlyVsJa = [...koKeys].filter(k => !jaKeys.has(k));
const koOnlyVsEn = [...koKeys].filter(k => !enKeys.has(k));

console.log('=== ja-JP에 있지만 en-US에 없는 키 ===');
console.log(jaOnlyVsEn.join('\n') || '(없음)');

console.log('\n=== ja-JP에 있지만 ko-KR에 없는 키 ===');
console.log(jaOnlyVsKo.join('\n') || '(없음)');

console.log('\n=== ko-KR에 있지만 ja-JP에 없는 키 ===');
console.log(koOnlyVsJa.join('\n') || '(없음)');

console.log('\n=== ko-KR에 있지만 en-US에 없는 키 ===');
console.log(koOnlyVsEn.join('\n') || '(없음)');

console.log('\n=== 통계 ===');
console.log('ja-JP:', jaKeys.size, 'en-US:', enKeys.size, 'ko-KR:', koKeys.size);
