// Biostat Buddy — saving work on this device only (IndexedDB). Nothing is uploaded.
const DB = "biostat-buddy", VER = 1;
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") { reject(new Error("Saving is not available in this browser.")); return; }
      const req = indexedDB.open(DB, VER);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("files")) d.createObjectStore("files", { keyPath: "id" });
        if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch(e => { dbp = null; throw e; });
  }
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode), st = t.objectStore(store);
    let out;
    Promise.resolve(fn(st)).then(r => { out = r; });
    t.oncomplete = () => resolve(out?.result !== undefined && out instanceof IDBRequest ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("Saving was cancelled (storage may be full)."));
  });
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const MAX_RECENT = 6;
const MAX_BYTES = 40 * 1024 * 1024;

// Save an uploaded file's bytes so it can be reopened later.
export async function saveFile(name, buf) {
  if (buf.byteLength > MAX_BYTES) return null;
  const id = `${name}::${buf.byteLength}`;
  const d = await db();
  const all = await reqP(d.transaction("files").objectStore("files").getAll());
  const prev = all.find(f => f.id === id);
  await tx("files", "readwrite", st => { st.put({ id, name, size: buf.byteLength, buf, savedAt: Date.now(), settings: prev?.settings || null }); });
  // Keep only the most recent files
  const old = all.filter(f => f.id !== id).sort((a, b) => b.savedAt - a.savedAt).slice(MAX_RECENT - 1);
  if (old.length) await tx("files", "readwrite", st => { old.forEach(f => st.delete(f.id)); });
  return id;
}
export async function listFiles() {
  const d = await db();
  const all = await reqP(d.transaction("files").objectStore("files").getAll());
  return all.map(({ id, name, size, savedAt }) => ({ id, name, size, savedAt })).sort((a, b) => b.savedAt - a.savedAt);
}
export async function getFile(id) {
  const d = await db();
  return reqP(d.transaction("files").objectStore("files").get(id));
}
export async function saveSettings(id, settings) {
  const d = await db();
  const f = await reqP(d.transaction("files").objectStore("files").get(id));
  if (!f) return;
  await tx("files", "readwrite", st => { st.put({ ...f, settings, savedAt: Date.now() }); });
}
export async function deleteFile(id) { await tx("files", "readwrite", st => { st.delete(id); }); }

export async function kvGet(key) { const d = await db(); return reqP(d.transaction("kv").objectStore("kv").get(key)); }
export async function kvSet(key, val) { await tx("kv", "readwrite", st => { st.put(val, key); }); }
