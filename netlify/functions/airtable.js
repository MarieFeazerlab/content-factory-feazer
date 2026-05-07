/* Airtable CRUD proxy — keeps the token server-side */

const BASE_ID = 'app59olgEI4U7pf1G';
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`;

const HEADERS = () => ({
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
});

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type':                 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, table, filter, fields, recordId } = body;

    if (!table) throw new Error('table required');

    const tableUrl = `${BASE_URL}/${encodeURIComponent(table)}`;

    let airtableRes, data;

    switch (action) {
      case 'list': {
        const params = new URLSearchParams();
        if (filter) params.set('filterByFormula', filter);
        params.set('pageSize', '100');
        airtableRes = await fetch(`${tableUrl}?${params}`, { headers: HEADERS() });
        data = await airtableRes.json();
        if (!airtableRes.ok) throw new Error(data.error?.message || 'Airtable error');
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ records: data.records || [] }) };
      }

      case 'create': {
        if (!fields) throw new Error('fields required');
        airtableRes = await fetch(tableUrl, {
          method: 'POST',
          headers: HEADERS(),
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
          headers: HEADERS(),
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
          headers: HEADERS(),
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
