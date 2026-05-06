import { openDB } from 'idb';

const DB_NAME = "SamiVisualAI";
const STORE_NAME = "items";
const DB_VERSION = 4; // رفعت الإصدار لضمان تحديث الهيكلية

export const initDB = async () => {
  // طلب جعل التخزين مستقراً وغير قابل للمسح من قبل المتصفح
  if (navigator.storage && navigator.storage.persist) {
    const persisted = await navigator.storage.persist();
    if (persisted) console.log("🚀 تم تفعيل وضع التخزين المستمر بنجاح");
  }

  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    },
  });
};

export const saveToDB = async (metadata, vector, image) => {
  const db = await initDB();
  const all = await db.getAll(STORE_NAME);
  
  // فحص التكرار (الاسم والتصنيف معاً)
  const isExist = all.some(i => i.metadata.name === metadata.name && i.metadata.category === metadata.category);
  if (isExist) throw new Error("هذا الصنف مسجل مسبقاً في النظام");
  
  return db.add(STORE_NAME, { 
    metadata, 
    vector, 
    image, 
    date: Date.now() 
  });
};

export const getAllProducts = async () => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const deleteFromDB = async (id) => {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
};

export const exportBackup = async () => {
  const data = await getAllProducts();
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Sami_Visual_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const importBackup = async (file) => {
  const db = await initDB();
  const text = await file.text();
  const data = JSON.parse(text);
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const currentItems = await store.getAll();
  let count = 0;

  for (const item of data) {
    const isDuplicate = currentItems.some(c => 
      c.metadata.name === item.metadata.name && 
      c.metadata.category === item.metadata.category
    );
    if (!isDuplicate) {
      delete item.id; // نحذف الـ ID القديم ليتولد تلقائياً في القاعدة الجديدة
      await store.add(item);
      count++;
    }
  }
  await tx.done;
  return count;
};
