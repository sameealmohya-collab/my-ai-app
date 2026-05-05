// تعريف اسم قاعدة البيانات واسم المخزن في مكان واحد لتسهيل التعديل مستقبلاً
const DB_NAME = "VisualDiscovery";
const STORE_NAME = "items"; 
let dbInstance = null;

/**
 * تهيئة قاعدة البيانات - تفتح الاتصال مرة واحدة فقط
 */
export const initDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);
    
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // إنشاء المخزن مع مفتاح تلقائي الزيادة
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject("❌ فشل في فتح قاعدة البيانات");
  });
};

/**
 * حفظ صنف جديد مع تحويل البصمة لنوع موفر للمساحة
 */
export const saveToDB = async (productData) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    
    const itemToSave = {
      ...productData,
      // تحويل المصفوفة العادية إلى Float32Array لتسريع المقارنة وتقليل الحجم
      vector: new Float32Array(productData.vector),
      createdAt: new Date().toISOString()
    };

    // نستخدم put بدلاً من add لضمان التحديث في حال وجود ID مكرر (أكثر أماناً)
    const request = store.put(itemToSave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject("❌ خطأ أثناء الحفظ في القاعدة");
  });
};

/**
 * جلب جميع الأصناف المحفوظة
 */
export const getAllProducts = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("❌ فشل جلب البيانات من المخزن");
  });
};

/**
 * حذف صنف محدد بواسطة المعرف (ID)
 */
export const deleteFromDB = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject("❌ فشل حذف الصنف");
  });
};

/**
 * تصدير نسخة احتياطية كاملة (JSON)
 */
export const exportBackup = async () => {
  const data = await getAllProducts();
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Sami_AI_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * استيراد نسخة احتياطية من ملف JSON
 */
export const importBackup = async (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const db = await initDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      
      data.forEach(item => {
        // نضمن أن البصمة تعود كـ Float32Array حتى بعد الاستيراد
        if (item.vector) item.vector = new Float32Array(Object.values(item.vector));
        store.put(item);
      });

      tx.oncomplete = () => {
        alert("✅ تم استعادة " + data.length + " صنف بنجاح!");
        window.location.reload();
      };
    } catch (err) {
      alert("❌ ملف النسخة الاحتياطية غير صالح");
    }
  };
  reader.readAsText(file);
};
