/* Airtable CRUD proxy — keeps the token server-side */

const BASE_ID = 'app59olgEI4U7pf1G';
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`;

const TABLE_MAP = {
  'Calendrier éditorial': 'tblqdCcogbkp8RZhJ',
};

const atHeaders = () => ({
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
});

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action, table, filter, fields, recordId } = req.body || {};

    if (!table) throw new Error('table required');

    const tableId  = TABLE_MAP[table] || encodeURIComponent(table);
    const tableUrl = `${BASE_URL}/${tableId}`;
    let airtableRes, data;

    switch (action) {
      case 'list': {
        const params = new URLSearchParams();
        if (filter) params.set('filterByFormula', filter);
        params.set('pageSize', '100');
        airtableRes = await fetch(`${tableUrl}?${params}`, { headers: atHeaders() });
        data = await airtableRes.json();
        if (airtableRes.status === 404) return res.status(200).json({ records: [] });
        if (!airtableRes.ok) throw new Error(data.error?.message || 'Airtable error');
        return res.status(200).json({ records: data.records || [] });
      }

      case 'create': {
        if (!fields) throw new Error('fields required');
        airtableRes = await fetch(tableUrl, {
          method:  'POST',
          headers: atHeaders(),
          body:    JSON.stringify({ fields }),
        });
        data = await airtableRes.json();
        if (!airtableRes.ok) throw new Error(data.error?.message || 'Airtable error');
        return res.status(200).json({ record: data });
      }

      case 'update': {
        if (!recordId || !fields) throw new Error('recordId and fields required');
        airtableRes = await fetch(`${tableUrl}/${recordId}`, {
          method:  'PATCH',
          headers: atHeaders(),
          body:    JSON.stringify({ fields }),
        });
        data = await airtableRes.json();
        if (!airtableRes.ok) throw new Error(data.error?.message || 'Airtable error');
        return res.status(200).json({ record: data });
      }

      case 'delete': {
        if (!recordId) throw new Error('recordId required');
        airtableRes = await fetch(`${tableUrl}/${recordId}`, {
          method:  'DELETE',
          headers: atHeaders(),
        });
        data = await airtableRes.json();
        if (!airtableRes.ok) throw new Error(data.error?.message || 'Airtable error');
        return res.status(200).json({ deleted: true });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
