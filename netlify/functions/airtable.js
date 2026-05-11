/* Airtable CRUD proxy — keeps the token server-side */

const BASE_ID = 'app59olgEI4U7pf1G';
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`;

// Only this table exists in the base. Unknown table names get graceful empty responses.
const TABLE_MAP = {
  'Calendrier éditorial': 'tblqdCcogbkp8RZhJ',
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type':                 'application/json',
};

const atHeaders = () => ({
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, table, filter, fields, recordId } = body;

    if (!table) throw new Error('table required');

    // Resolve table name to ID, fall back gracefully for unknown tables
    const tableId = TABLE_MAP[table];
    if (!tableId) {
      console.log(`[airtable] Unknown table "${table}" — returning empty response`);
      if (action === 'list')   return { statusCode: 200, headers: CORS, body: JSON.stringify({ records: [] }) };
      if (action === 'create') return { statusCode: 200, headers: CORS, body: JSON.stringify({ record: { id: null, fields: {} } }) };
      if (action === 'update') return { statusCode: 200, headers: CORS, body: JSON.stringify({ record: { id: recordId, fields: {} } }) };
      if (action === 'delete') return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
      return { statusCode: 200, headers: CORS, body: JSON.stringify({}) };
    }

    const tableUrl = `${BASE_URL}/${tableId}`;
    let airtableRes, data;

    switch (action) {
      case 'list': {
        const params = new URLSearchParams();
        if (filter) params.set('filterByFormula', filter);
        params.set('pageSize', '100');
        airtableRes = await fetch(`${tableUrl}?${params}`, { headers: atHeaders() });
        data = await airtableRes.json();
        if (!airtableRes.ok) throw new Error(data.error?.message || 'Airtable error');
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ records: data.records || [] }) };
      }

      case 'create': {
        if (!fields) throw new Error('fields required');
        airtableRes = await fetch(tableUrl, {
          method: 'POST',
          headers: atHeaders(),
          body: JSON.stringify({ fields }),
        });
        data = await airtableRes.json();
        if (!airtableRes.ok) throw new Error(data.error?.message || 'Airtable error');
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ record: data }) };
      }

      case 'update': {
        if (!recordId || !fields) throw new Error('recordId and fields required');
        airtableRes = await fetch(`${tableUrl}/${recordId}`, {
          method: 'PATCH',
          headers: atHeaders(),
          body: JSON.stringify({ fields }),
        });
        data = await airtableRes.json();
        if (!airtableRes.ok) throw new Error(data.error?.message || 'Airtable error');
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ record: data }) };
      }

      case 'delete': {
        if (!recordId) throw new Error('recordId required');
        airtableRes = await fetch(`${tableUrl}/${recordId}`, {
          method: 'DELETE',
          headers: atHeaders(),
        });
        data = await airtableRes.json();
        if (!airtableRes.ok) throw new Error(data.error?.message || 'Airtable error');
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
