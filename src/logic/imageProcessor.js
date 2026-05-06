import * as tf from '@tensorflow/tfjs';

export const calculateSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB) return 0;
  let dotProduct = 0, mA = 0, mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  const mag = Math.sqrt(mA) * Math.sqrt(mB);
  return mag === 0 ? 0 : dotProduct / mag;
};

export const processImage = (imgElement) => {
  const canvas = document.createElement('canvas');
  canvas.width = 224;
  canvas.height = 224;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgElement, 0, 0, 224, 224);
  
  const cleanup = () => {
    canvas.width = 0;
    canvas.height = 0;
  };
  return { canvas, cleanup };
};

export const getVector = async (model, imgSource) => {
  return tf.tidy(() => {
    const activation = model.infer(imgSource, true);
    return Array.from(activation.dataSync());
  });
};
