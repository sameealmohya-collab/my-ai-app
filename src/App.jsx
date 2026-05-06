import React, { useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { calculateSimilarity, processImage, getVector } from './logic/imageProcessor';
import { initDB, saveToDB, getAllProducts, deleteFromDB, exportBackup, importBackup } from './logic/storage';

function App() {
  const [model, setModel] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [originalInventory, setOriginalInventory] = useState([]);
  const [status, setStatus] = useState('⏳ جاري تهيئة نظام سامي الذكي...');
  const [product, setProduct] = useState({ name: '', price: '', qty: '' });
  const [category, setCategory] = useState('عام');
  const [previews, setPreviews] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [darkMode, setDarkMode] = useState(true);

  const refreshData = async () => {
    const data = await getAllProducts();
    // تحويل الـ Blobs إلى روابط عرض (URLs) مؤقتة لتظهر الصور
    const formattedData = data.map(item => ({
      ...item,
      displayUrl: item.image instanceof Blob ? URL.createObjectURL(item.image) : item.image
    }));
    setInventory([...formattedData].reverse());
    setOriginalInventory(formattedData);
  };

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        await refreshData();
        await tf.ready();
        const loadedModel = await mobilenet.load({ version: 1, alpha: 0.25 });
        setModel(loadedModel);
        setStatus('✅ النظام جاهز ويعمل بذاكرة Blobs');
      } catch (e) {
        setStatus('⚠️ فشل في تهيئة النظام');
        console.error(e);
      }
    })();
    // تنظيف الروابط عند إغلاق التطبيق لتوفير الذاكرة العشوائية
    return () => inventory.forEach(item => URL.revokeObjectURL(item.displayUrl));
  }, []);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...urls]);
  };

  const handleSave = async () => {
    if (!product.name || previews.length === 0) {
      setStatus('⚠️ يرجى إدخال البيانات والصور');
      return;
    }
    
    setStatus('💾 جاري ضغط الصور وحفظها كـ Blobs...');
    try {
      for (const url of previews) {
        const img = new Image();
        img.src = url;
        await new Promise((resolve) => {
          img.onload = async () => {
            const { canvas, cleanup } = processImage(img);
            const vec = await getVector(model, canvas);
            
            // التعديل الجوهري: تحويل الكانفاس إلى Blob بدلاً من DataURL
            canvas.toBlob(async (blob) => {
              await saveToDB({ ...product, category }, vec, blob);
              cleanup();
              resolve();
            }, 'image/jpeg', 0.6); // ضغط 60% وتخزين ثنائي
          };
        });
        URL.revokeObjectURL(url);
      }
      setPreviews([]);
      setProduct({ name: '', price: '', qty: '' });
      await refreshData();
      setStatus('✅ تم الحفظ (توفير 30% من المساحة)');
    } catch (err) {
      setStatus(`❌ خطأ: ${err.message}`);
    }
  };

  const searchByImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !model) return;
    setStatus('🔍 تحليل بصري عالي السرعة...');
    
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      const { canvas, cleanup } = processImage(img);
      const queryVector = await getVector(model, canvas);
      
      const scope = (category === 'الكل' || category === 'عام') 
        ? originalInventory 
        : originalInventory.filter(i => i.metadata.category === category);
      
      const results = scope.map(item => ({
        ...item,
        score: calculateSimilarity(queryVector, item.vector)
      })).filter(res => res.score > 0.7)
         .sort((a, b) => b.score - a.score);

      setInventory(results);
      setStatus(results.length > 0 ? `✅ وجدنا ${results.length} تطابق` : '❌ لا توجد نتائج');
      cleanup();
      URL.revokeObjectURL(img.src);
    };
  };

  const theme = {
    bg: darkMode ? '#000' : '#f5f5f5',
    card: darkMode ? '#121212' : '#fff',
    text: darkMode ? '#fff' : '#000',
    accent: '#00c853'
  };

  return (
    <div style={{ padding: '15px', direction: 'rtl', backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', fontFamily: 'Arial' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ color: theme.accent, margin: 0, fontSize: '18px' }}>Sami Visual AI (Optimized)</h2>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={() => setDarkMode(!darkMode)} style={btnSmall}>{darkMode ? '☀️ نهار' : '🌙 ليل'}</button>
          <button onClick={exportBackup} style={btnSmall}>📤 تصدير</button>
          {/* إعادة زر الاستيراد */}
          <label style={btnSmall}>
            📥 استيراد
            <input 
              type="file" 
              onChange={async (e) => {
                const file = e.target.files[0];
                if (file) {
                  setStatus('📥 جاري استيراد البيانات...');
                  try {
                    const count = await importBackup(file);
                    await refreshData();
                    setStatus(`✅ تم استيراد ${count} أصناف بنجاح`);
                  } catch (err) {
                    setStatus('❌ فشل الاستيراد: ملف غير مدعوم');
                  }
                }
              }} 
              hidden 
            />
          </label>
        </div>
      </header>


      <p style={{ textAlign: 'center', fontSize: '13px', color: theme.accent }}>{status}</p>

      <div style={{ background: theme.card, padding: '15px', borderRadius: '15px', border: '1px solid #333' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <label style={btnAction('#00c853')}>➕ صور جديدة<input type="file" multiple onChange={handleImageSelect} hidden /></label>
          <label style={btnAction('#ffa000')}>🔍 بحث بصري<input type="file" onChange={searchByImage} hidden /></label>
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '10px' }}>
          {previews.map((url, i) => (
            <img key={i} src={url} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} alt="preview" />
          ))}
        </div>

        <input placeholder="اسم الصنف" value={product.name} onChange={e => setProduct({...product, name: e.target.value})} style={inputStyle(theme)} />
        
        <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle(theme)}>
          <option value="عام">عام</option>
          <option value="قطع غيار">قطع غيار</option>
          <option value="شخصي">شخصي</option>
        </select>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input placeholder="السعر" type="number" value={product.price} onChange={e => setProduct({...product, price: e.target.value})} style={inputStyle(theme)} />
          <input placeholder="الكمية" type="number" value={product.qty} onChange={e => setProduct({...product, qty: e.target.value})} style={inputStyle(theme)} />
        </div>

        <button onClick={handleSave} style={btnSave(theme.accent)}>حفظ دائم (Blob Storage) 💾</button>
      </div>

      <input 
        placeholder="🔍 ابحث بالاسم..." 
        value={searchTerm} 
        onChange={e => setSearchTerm(e.target.value)} 
        style={{ ...inputStyle(theme), borderRadius: '25px', marginTop: '20px' }} 
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '15px' }}>
        {inventory.filter(i => i.metadata.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
          <div key={item.id} style={{ background: theme.card, borderRadius: '12px', overflow: 'hidden', border: '1px solid #222' }}>
            <img src={item.displayUrl} style={{ width: '100%', height: '110px', objectFit: 'cover' }} alt="product" />
            <div style={{ padding: '10px' }}>
              <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold' }}>{item.metadata.name}</p>
              <p style={{ margin: '5px 0', color: theme.accent, fontSize: '13px' }}>{item.metadata.price} ريال</p>
              <button onClick={async () => { if(window.confirm('حذف؟')){ await deleteFromDB(item.id); refreshData(); } }} style={{ background: 'none', border: 'none', color: '#ff5252', cursor: 'pointer', fontSize: '12px' }}>🗑️ حذف</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// الستايلات (نفس ستايلاتك السابقة)
const btnSmall = { padding: '6px 10px', fontSize: '11px', borderRadius: '6px', border: 'none', background: '#222', color: '#fff' };
const btnAction = (color) => ({ flex: 1, padding: '12px', background: color, color: '#000', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', cursor: 'pointer' });
const inputStyle = (theme) => ({ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: 'none', background: '#1a1a1a', color: '#fff', boxSizing: 'border-box' });
const btnSave = (color) => ({ width: '100%', padding: '14px', background: color, color: '#000', borderRadius: '10px', border: 'none', fontWeight: 'bold', marginTop: '10px' });

export default App;
