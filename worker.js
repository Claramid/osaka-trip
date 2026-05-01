export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const KEY = 'trip-data-v1';

    // GET: return all data
    if (request.method === 'GET' && url.pathname === '/api/data') {
      const raw = await env.TRIP.get(KEY);
      return new Response(raw || '{}', {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // POST: merge incoming data
    if (request.method === 'POST' && url.pathname === '/api/data') {
      const incoming = await request.json();
      const raw = await env.TRIP.get(KEY);
      const existing = raw ? JSON.parse(raw) : {};

      // merge comments
      if (incoming.comments) {
        if (!existing.comments) existing.comments = {};
        for (const [k, arr] of Object.entries(incoming.comments)) {
          if (!existing.comments[k]) existing.comments[k] = [];
          const keys = new Set(existing.comments[k].map(c => c.name + '|' + c.time + '|' + c.text));
          for (const c of arr) {
            if (!keys.has(c.name + '|' + c.time + '|' + c.text)) {
              existing.comments[k].push(c);
              keys.add(c.name + '|' + c.time + '|' + c.text);
            }
          }
        }
      }

      // merge notes
      if (incoming.notes) {
        if (!existing.notes) existing.notes = [];
        const keys = new Set(existing.notes.map(n => n.name + '|' + n.time + '|' + n.text));
        for (const n of incoming.notes) {
          if (!keys.has(n.name + '|' + n.time + '|' + n.text)) {
            existing.notes.push(n);
            keys.add(n.name + '|' + n.time + '|' + n.text);
          }
        }
      }

      // merge votes (last write wins per action per spot)
      if (incoming.votes) {
        if (!existing.votes) existing.votes = {};
        for (const [k, acts] of Object.entries(incoming.votes)) {
          if (!existing.votes[k]) existing.votes[k] = {};
          for (const [act, names] of Object.entries(acts)) {
            existing.votes[k][act] = names;
          }
        }
      }

      // merge edits (last write wins)
      if (incoming.edits) {
        if (!existing.edits) existing.edits = {};
        for (const [k, fields] of Object.entries(incoming.edits)) {
          if (!existing.edits[k]) existing.edits[k] = {};
          Object.assign(existing.edits[k], fields);
        }
      }

      // merge shopChecked (last write wins)
      if (incoming.shopChecked) {
        if (!existing.shopChecked) existing.shopChecked = {};
        Object.assign(existing.shopChecked, incoming.shopChecked);
      }

      // merge checklist (last write wins)
      if (incoming.checklist) {
        existing.checklist = incoming.checklist;
      }

      // merge addedSpots (per day, dedup by id)
      if (incoming.addedSpots) {
        if (!existing.addedSpots) existing.addedSpots = {};
        for (const [day, arr] of Object.entries(incoming.addedSpots)) {
          if (!existing.addedSpots[day]) existing.addedSpots[day] = [];
          const ids = new Set(existing.addedSpots[day].map(s => s.id));
          for (const s of arr) {
            if (!ids.has(s.id)) { existing.addedSpots[day].push(s); ids.add(s.id); }
          }
        }
      }

      // merge deletedSpots (flag merge)
      if (incoming.deletedSpots) {
        if (!existing.deletedSpots) existing.deletedSpots = {};
        Object.assign(existing.deletedSpots, incoming.deletedSpots);
      }

      await env.TRIP.put(KEY, JSON.stringify(existing));

      return new Response(JSON.stringify(existing), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // DELETE a note by index (body: {noteIndex: n})
    if (request.method === 'POST' && url.pathname === '/api/delete-note') {
      const { noteIndex } = await request.json();
      const raw = await env.TRIP.get(KEY);
      const existing = raw ? JSON.parse(raw) : {};
      if (existing.notes && noteIndex >= 0 && noteIndex < existing.notes.length) {
        existing.notes.splice(noteIndex, 1);
        await env.TRIP.put(KEY, JSON.stringify(existing));
      }
      return new Response(JSON.stringify(existing), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response('osaka-trip-api is running', { headers: cors });
  },
};
