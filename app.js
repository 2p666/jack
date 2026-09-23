const bat = document.querySelector('#flyingBat');
const batLetter = document.querySelector('#batLetter');
bat.addEventListener('error', () => { bat.src = 'assets/bats/bat-1.svg'; }, { once: true });
setTimeout(() => { bat.classList.add('retrieve'); batLetter.classList.add('taken'); }, 10000);

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
const movieForm = document.querySelector('#movieForm');
const movieUrl = document.querySelector('#movieUrl');
const moviePlayer = document.querySelector('#moviePlayer');
const movieStatus = document.querySelector('#movieStatus');
const movieSubmit = document.querySelector('#movieSubmit');
const cinema = document.querySelector('#cinema');
const backdropInput = document.querySelector('#backdropInput');
const scene = document.querySelector('#scene');
let stream = null, scanTimer = null, targetSignature = null, stableHits = 0, cinemaUnlocked = false;

document.querySelectorAll('.letter').forEach(letter => {
  const play = () => { letter.classList.remove('playful'); void letter.offsetWidth; letter.classList.add('playful'); };
  letter.addEventListener('click', play);
  letter.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); play(); } });
});
function applyBackdrop(source, save = true) {
  scene.style.setProperty('--custom-backdrop', `url("${source}")`);
  scene.classList.add('custom-backdrop');
  if (save) {
    try { localStorage.setItem('mel-custom-backdrop', source); } catch (error) { /* image remains active in this visit */ }
  }
}
backdropInput.addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => applyBackdrop(reader.result));
  reader.readAsDataURL(file);
});
const savedBackdrop = localStorage.getItem('mel-custom-backdrop');
if (savedBackdrop) applyBackdrop(savedBackdrop, false);

function embedUrl(value) {
  const address = new URL(value.trim());
  const host = address.hostname.replace(/^www\./, '');
  const driveMatch = address.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if ((host === 'drive.google.com' || host === 'docs.google.com') && driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }
  if (host === 'youtu.be') return `https://www.youtube.com/embed/${address.pathname.slice(1)}`;
  if (host.endsWith('youtube.com')) {
    const id = address.searchParams.get('v');
    if (id) return `https://www.youtube.com/embed/${id}`;
    if (address.pathname.startsWith('/embed/')) return address.toString();
  }
  if (host === 'vimeo.com') {
    const id = address.pathname.split('/').filter(Boolean).pop();
    if (id) return `https://player.vimeo.com/video/${id}`;
  }
  return address.toString();
}
function setMovie(value, save = true) {
  if (!cinemaUnlocked) return;
  try {
    const source = embedUrl(value);
    moviePlayer.src = source;
    movieUrl.value = value;
    movieStatus.textContent = 'A tela foi acesa. Se o vídeo não aparecer, a plataforma não permite assistir dentro de outro site.';
    if (save) localStorage.setItem('mel-movie-link', value);
  } catch (error) {
    movieStatus.textContent = 'Esse link não parece válido. Cole o endereço completo do vídeo ou da página de incorporação.';
  }
}
movieForm.addEventListener('submit', event => { event.preventDefault(); setMovie(movieUrl.value); });
const savedMovie = localStorage.getItem('mel-movie-link');

function unlockCinema() {
  cinemaUnlocked = true;
  cinema.classList.remove('locked');
  movieUrl.disabled = false;
  movieSubmit.disabled = false;
  movieStatus.textContent = 'O portal foi aberto. Escolha o filme para a nossa noite.';
  if (savedMovie) setMovie(savedMovie, false);
}

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
  seal.classList.add('show'); enter.disabled = false; unlockCinema(); status.textContent = 'A luminária encontrou o portal.';
}
function stopCamera() {
  clearInterval(scanTimer); scanTimer = null; stableHits = 0; meter.style.width = '0%'; percent.textContent = '0%';
  if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
  video.srcObject = null; seal.classList.remove('show'); enter.disabled = true;
}
openCamera.addEventListener('click', startCamera);
closeCamera.addEventListener('click', () => { stopCamera(); overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true'); });
enter.addEventListener('click', () => {
  stopCamera(); overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true');
  document.querySelector('#cinema').scrollIntoView({ behavior: 'smooth' });
});
