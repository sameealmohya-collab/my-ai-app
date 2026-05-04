export const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("VisualDiscovery", 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("products")) {
        db.createObjectStore("products", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("فشل فتح قاعدة البيانات");
  });
};

export const saveToDB = async (productName, embedding) => {
  const db = await openDB();
  // تحويل البصمة إلى مصفوفة أرقام قبل بدء المعاملة لضمان السرعة
  const embeddingArray = await embedding.array(); 
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");
    
    const request = store.add({ 
      name: productName, 
      vector: embeddingArray,
      date: new Date().toISOString() 
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject("خطأ أثناء حفظ البيانات");
  });
};

export const getAllProducts = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("products", "readonly");
    const store = tx.objectStore("products");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("فشل جلب البيانات");
  });
};

