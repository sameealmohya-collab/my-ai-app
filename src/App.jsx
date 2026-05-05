import React, { useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { openDB } from 'idb';

function App() {
  const [model, setModel] = useState(null);
  const [db, setDb] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [status, setStatus] = useState('⏳ جاري تهيئة نظام سامي الذكي...');
  const [product, setProduct] = useState({ name: '', price: '', qty: '' });
  const [previews, setPreviews] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [darkMode, setDarkMode] = useState(true);

  // 1. دالة معالجة الصور (التصغير والضغط لضمان السرعة وتوفير المساحة)
  const processImage = (imgElement, width = 224, height = 224) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0, width, height);
    return canvas;
  };

  // 2. خوارزمية المقارنة السريعة (بدون استخدام Tensors داخل الحلقات لزيادة السرعة)
  const calculateSimilarity = (vecA, vecB) => {
    let dotProduct = 0, mA = 0, mB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      mA += vecA[i] * vecA[i];
      mB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
  };

  useEffect(() => {
    async function init() {
      const database = await openDB('Sami_Pro_Global_DB', 1, {
        upgrade(db) { 
          if (!db.objectStoreNames.contains('items')) {
            db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
          }
        },
      });
      setDb(database);
      const allData = await database.getAll('items');
      setInventory(allData.reverse());
      try {
        await tf.ready();
        // تحميل النموذج بنسخة خفيفة
        const loadedModel = await mobilenet.load({ version: 1, alpha: 0.25 });
        setModel(loadedModel);
        setStatus('✅ Sami AI جاهز للعمل');
      } catch (e) { 
        setStatus('⚠️ خطأ في تحميل الذكاء الاصطناعي'); 
      }
    }
    init();
  }, []);

  // 3. البحث البصري المحسن
  const searchByImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !model) return;

    setStatus('🔍 جاري التحليل السريع...');
    const reader = new FileReader();
    reader.onload = async (f) => {
      const img = new Image();
      img.src = f.target.result;
      img.onload = async () => {
        // تصغير الصورة قبل التحليل
        const smallCanvas = processImage(img);
        
        const queryVector = tf.tidy(() => {
          const activation = model.infer(smallCanvas, true);
          return Array.from(activation.dataSync());
        });
        
        const allItems = await db.getAll('items');
        const results = allItems.map(item => ({
          ...item,
          score: calculateSimilarity(queryVector, item.vector)
        }));

        const filtered = results
          .filter(res => res.score > 0.60) // تقليل العتبة قليلاً لمرونة أكبر
          .sort((a, b) => b.score - a.score);

        setInventory(filtered);
        setStatus(filtered.length > 0 ? `✅ تم إيجاد ${filtered.length} مطابقة` : '❌ لا يوجد نتائج مشابهة');
      };
    };
    reader.readAsDataURL(file);
  };

  // 4. الحفظ الذكي (حفظ الصور المصغرة فقط لتجنب امتلاء الذاكرة)
  const saveProduct = async () => {
    if (!product.name || previews.length === 0) return alert("أدخل البيانات والصورة!");
    setStatus('💾 جاري الحفظ وتوليد البصمة...');

    for (const imgBase64 of previews) {
      const img = new Image();
      img.src = imgBase64;
      await new Promise(res => {
        img.onload = async () => {
          const smallCanvas = processImage(img);
          
          // توليد البصمة الرقمية
          const vector = tf.tidy(() => {
            const activation = model.infer(smallCanvas, true);
            return Array.from(activation.dataSync());
          });

          // حفظ النسخة المصغرة فقط (DataURL) لتوفير المساحة
          const compressedImg = smallCanvas.toDataURL('image/jpeg', 0.7);

          await db.add('items', { 
            name: product.name, 
            price: product.price || '0', 
            qty: product.qty || '1',
            vector, 
            image: compressedImg 
          });
          res();
        };
      });
    }

    const updatedData = await db.getAll('items');
    setInventory(updatedData.reverse());
    setPreviews([]); 
    setProduct({ name: '', price: '', qty: '' });
    setStatus('✅ تم الحفظ بنجاح');
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (f) => setPreviews(prev => [...prev, f.target.result]);
      reader.readAsDataURL(file);
    });
  };

  const refreshInventory = async () => {
    const allData = await db.getAll('items');
    setInventory(allData.reverse());
    setStatus('✅ تم تحديث المخزن');
  };

  const shareWhatsApp = (item) => {
    const text = `📦 *صنف من مخزن سامي*\n🔹 الاسم: ${item.name}\n💰 السعر: ${item.price} ريال\n🔢 المتوفر: ${item.qty}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const theme = {
    bg: darkMode ? '#121212' : '#f8f9fa',
    card: darkMode ? '#1e1e1e' : '#ffffff',
    text: darkMode ? '#ffffff' : '#121212',
    accent: '#00e676'
  };

  return (
    <div style={{ padding: '15px', direction: 'rtl', backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', transition: '0.3s', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <button onClick={() => setDarkMode(!darkMode)} style={miniBtn(theme)}>{darkMode ? '☀️ نهار' : '🌙 ليل'}</button>
        <h2 style={{ color: theme.accent, margin: 0, fontSize: '18px' }}>Visual Discovery AI</h2>
        <button onClick={refreshInventory} style={miniBtn(theme)}>🔄 تحديث</button>
      </div>
      <p style={{ fontSize: '11px', textAlign: 'center', color: theme.accent }}>{status}</p>

      <section style={{ background: theme.card, padding: '15px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <label style={uploadBtn(theme.accent)}>➕ إضافة صور<input type="file" multiple onChange={handleFileSelect} hidden /></label>
          <label style={{ ...uploadBtn('#ff9800'), color: '#fff' }}>🔍 بحث بصري<input type="file" accept="image/*" onChange={searchByImage} hidden /></label>
        </div>

        {previews.length > 0 && (
          <div style={previewScroll}>
            {previews.map((p, i) => (
              <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                <img src={p} style={thumbStyle} alt="preview" />
                <button onClick={() => setPreviews(previews.filter((_, idx) => idx !== i))} style={delThumb}>×</button>
              </div>
            ))}
          </div>
        )}

        <input placeholder="اسم الصنف" value={product.name} onChange={e => setProduct({...product, name: e.target.value})} style={inStyle(theme)} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <input placeholder="السعر" type="number" value={product.price} onChange={e => setProduct({...product, price: e.target.value})} style={inStyle(theme)} />
          <input placeholder="الكمية" type="number" value={product.qty} onChange={e => setProduct({...product, qty: e.target.value})} style={inStyle(theme)} />
        </div>
        <button onClick={saveProduct} style={saveBtn(theme.accent)}>حفظ في قاعدة البيانات 💾</button>
      </section>

      <input placeholder="🔍 ابحث بالاسم..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={searchStyle(theme)} />

      <div style={gridStyle}>
        {inventory.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
          <div key={item.id} style={{ background: theme.card, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${darkMode ? '#333' : '#ddd'}` }}>
            <img src={item.image} style={{ width: '100%', height: '110px', objectFit: 'cover' }} alt={item.name} />
            <div style={{ padding: '8px' }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{item.name}</p>
              <p style={{ color: theme.accent, fontSize: '11px', margin: '4px 0' }}>{item.price} ريال</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #444', paddingTop: '5px' }}>
                <button onClick={() => shareWhatsApp(item)} style={actionBtn}>📲 مشاركة</button>
                <button onClick={async () => { if(window.confirm('حذف؟')) { await db.delete('items', item.id); setInventory(inventory.filter(x => x.id !== item.id)) } }} style={{ ...actionBtn, color: '#ff5252' }}>🗑️ حذف</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// الستايلات المساعدة
const miniBtn = (theme) => ({ padding: '6px 12px', fontSize: '11px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: theme.card, color: theme.text });
const uploadBtn = (color) => ({ flex: 1, padding: '12px', background: color, color: '#000', borderRadius: '10px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' });
const previewScroll = { display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '15px', padding: '5px' };
const thumbStyle = { width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '2px solid #00e676' };
const delThumb = { position: 'absolute', top: -5, right: -5, background: '#ff5252', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px' };
const inStyle = (theme) => ({ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: 'none', background: theme.bg, color: theme.text, outline: 'none' });
const saveBtn = (color) => ({ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', background: color, color: '#000', fontWeight: 'bold', cursor: 'pointer' });
const searchStyle = (theme) => ({ width: '100%', padding: '15px', borderRadius: '25px', border: 'none', background: theme.card, color: theme.text, marginTop: '20px', outline: 'none' });
const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' };
const actionBtn = { background: 'none', border: 'none', fontSize: '11px', cursor: 'pointer', color: '#38bdf8', padding: '5px' };

export default App;
