const batFrames = ['assets/bats/bat-1.svg', 'assets/bats/bat-2.svg', 'assets/bats/bat-3.svg'];
const bat = document.querySelector('#flyingBat');
let frame = 0;
const batTimer = setInterval(() => { bat.src = batFrames[frame++ % batFrames.length]; }, 120);
setTimeout(() => { bat.classList.add('fly'); clearInterval(batTimer); }, 70);

const overlay = document.querySelector('#cameraOverlay');
const openCamera = document.querySelector('#openCamera');
const closeCamera = document.querySelector('#closeCamera');
const video = document.querySelector('#cameraFeed');
const status = document.querySelector('#cameraStatus');
const seal = document.querySelector('#detectedSeal');
const enter = document.querySelector('#enterPortal');
const canvas = document.querySelector('#visionCanvas');
const reference = document.querySelector('#lampReference');
const meter = document.querySelector('#scanMeter');
const percent = document.querySelector('#scanPercent');
let stream = null, scanTimer = null, targetSignature = null, stableHits = 0;

function signature(source, width, height) {
  const surface = document.createElement('canvas');
  surface.width = 32; surface.height = 40;
  const context = surface.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, 0, 0, width, height, 0, 0, 32, 40);
  const pixels = context.getImageData(0, 0, 32, 40).data, values = [];
  for (let index = 0; index < pixels.length; index += 4) values.push(.2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2]);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length) || 1;
  return values.map(value => (value - average) / deviation);
}
function similarity(first, second) { return first.reduce((sum, value, index) => sum + Math.abs(value - second[index]), 0) / first.length; }
function prepareReference() {
  if (!reference.naturalWidth || !reference.naturalHeight) return false;
  targetSignature = signature(reference, reference.naturalWidth, reference.naturalHeight);
  return true;
}
reference.addEventListener('load', prepareReference);
if (reference.complete) prepareReference();

async function startCamera() {
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  if (!targetSignature && !prepareReference()) { status.textContent = 'A referência da luminária ainda está carregando. Tente novamente em alguns segundos.'; return; }
  status.textContent = 'Pedindo permissão para a câmera…';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    status.textContent = 'A câmera está analisando. Enquadre a lua e a silhueta dentro do círculo.';
    scanTimer = setInterval(scanFrame, 220);
  } catch (error) { status.textContent = 'Não foi possível abrir a câmera. Verifique a permissão do navegador.'; }
}
function scanFrame() {
  if (!targetSignature || !video.videoWidth) return;
  const viewportWidth = video.videoWidth, viewportHeight = video.videoHeight, referenceRatio = 204 / 248;
  let sourceWidth = Math.min(viewportWidth, viewportHeight * referenceRatio), sourceHeight = sourceWidth / referenceRatio;
  if (sourceHeight > viewportHeight) { sourceHeight = viewportHeight; sourceWidth = sourceHeight * referenceRatio; }
  const sourceX = (viewportWidth - sourceWidth) / 2, sourceY = (viewportHeight - sourceHeight) / 2;
  canvas.width = 204; canvas.height = 248;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 204, 248);
  const score = similarity(signature(canvas, 204, 248), targetSignature);
  const connection = Math.max(0, Math.min(100, Math.round((1 - score / 1.12) * 100)));
  meter.style.width = `${connection}%`; percent.textContent = `${connection}%`;
  stableHits = score < 1.02 ? stableHits + 1 : 0;
  if (stableHits >= 2) recognize();
}
function recognize() {
  clearInterval(scanTimer); scanTimer = null; meter.style.width = '100%'; percent.textContent = '100%';
  seal.classList.add('show'); enter.disabled = false; status.textContent = 'A luminária encontrou o portal.';
}
function stopCamera() {
  clearInterval(scanTimer); scanTimer = null; stableHits = 0; meter.style.width = '0%'; percent.textContent = '0%';
  if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
  video.srcObject = null; seal.classList.remove('show'); enter.disabled = true;
}
openCamera.addEventListener('click', startCamera);
closeCamera.addEventListener('click', () => { stopCamera(); overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true'); });
enter.addEventListener('click', () => { status.textContent = 'O portal está pronto — a próxima página entrará aqui.'; });
