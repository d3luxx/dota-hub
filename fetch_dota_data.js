import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://waybpnkztszkldlwxuge.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY не найден');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function parseCyberScore() {
  console.log('🚀 Запуск парсинга команд и игроков с CyberScore...');

  try {
    const response = await fetch('https://cyberscore.live/en/teams/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`Ошибка загрузки страницы: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const teamsToInsert = [];

    // Ищем таблицу команд
    $('table tbody tr').each((index, el) => {
      if (index >= 20) return; // Берем топ-20 команд

      const row = $(el);
      const rank = parseInt(row.find('td').eq(0).text().trim()) || (index + 1);
      const nameEl = row.find('td').eq(1);
      const name = nameEl.find('a').text().trim() || nameEl.text().trim();
      const teamUrl = nameEl.find('a').attr('href');
      const logoUrl = row.find('img').attr('src') || '';

      const rating = row.find('td').eq(2).text().trim() || '3.00';
      const region = row.find('td').eq(3).text().trim() || 'Global';
      const games = parseInt(row.find('td').eq(4).text().trim()) || 100;
      const winrate = parseInt(row.find('td').eq(5).text().trim().replace('%', '')) || 50;

      if (name) {
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        teamsToInsert.push({
          id,
          rank,
          name,
          tag: name.substring(0, 4).toUpperCase(),
          logo_url: logoUrl.startsWith('http') ? logoUrl : `https://media.cyberscore.live${logoUrl}`,
          rating: parseFloat(rating) || 3.0,
          region,
          region_flag: '🌍',
          games,
          wins: Math.round((games * winrate) / 100),
          losses: Math.round((games * (100 - winrate)) / 100),
          winrate,
          prize: '$' + (games * 5000).toLocaleString()
        });
      }
    });

    console.log(`Найдено команд: ${teamsToInsert.length}`);

    if (teamsToInsert.length > 0) {
      const { error } = await supabase.from('teams').upsert(teamsToInsert);
      if (error) console.error('Ошибка сохранения команд:', error);
      else console.log('✅ Все команды сохранены в Supabase!');
    }

  } catch (err) {
    console.error('Ошибка при парсинге:', err.message);
  }
}

parseCyberScore();
