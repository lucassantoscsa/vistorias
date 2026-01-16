import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. CONFIGURAÇÕES (Preencha aqui)
const IMGBB_API_KEY = "06912b4ff3815b5bdfe13a5e8ad9938d"; 
const firebaseConfig = {
  apiKey: "AIzaSyAe87gJkAQv9v1dmSEgk9V7OLxpHZd1LZc",
  authDomain: "vistorias-2daf6.firebaseapp.com",
  projectId: "vistorias-2daf6",
  storageBucket: "vistorias-2daf6.firebasestorage.app",
  messagingSenderId: "867600856579",
  appId: "1:867600856579:web:96da5eb8958aa559cdc036",
};
// Inicialização
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const { jsPDF } = window.jspdf;

let currentUser = "";
let currentPropertyId = "";
let currentPropertyData = null;
let editingInspectionIndex = null;

// --- 2. NAVEGAÇÃO E LOGIN ---
window.showScreen = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    if(screenId === 'screen-dashboard') window.renderProperties();
};

window.login = (user) => {
    currentUser = user;
    window.showScreen('screen-dashboard');
};

// --- 3. GESTÃO DE IMÓVEIS ---
window.searchCEP = async () => {
    const cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length === 8) {
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (!data.erro) {
                document.getElementById('rua').value = data.logradouro;
                document.getElementById('bairro').value = data.bairro;
                document.getElementById('cidade').value = data.localidade;
            }
        } catch (e) { console.error("Erro ViaCEP"); }
    }
};

window.saveProperty = async () => {
    const btn = document.getElementById('btnSaveProp');
    const p = {
        rua: document.getElementById('rua').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        numero: document.getElementById('numero').value,
        complemento: document.getElementById('complemento').value,
        createdAt: Date.now(),
        vistorias: []
    };
    if(!p.rua || !p.numero) return alert("Preencha o endereço!");
    btn.disabled = true;
    try {
        await addDoc(collection(db, "imoveis"), p);
        window.showScreen('screen-dashboard');
    } catch (e) { alert("Erro ao salvar."); }
    btn.disabled = false;
};

window.renderProperties = async () => {
    const list = document.getElementById('property-list');
    const search = document.getElementById('searchBar').value.toLowerCase();
    list.innerHTML = "<p style='padding:20px'>Carregando...</p>";
    const q = query(collection(db, "imoveis"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    list.innerHTML = "";
    querySnapshot.forEach((docSnap) => {
        const p = docSnap.data();
        const full = `${p.rua}, ${p.numero} ${p.complemento || ''}`;
        if (full.toLowerCase().includes(search)) {
            const div = document.createElement('div');
            div.className = 'property-item';
            div.innerHTML = `<div><strong>${full}</strong><br><small>${p.bairro}</small></div><i class="material-icons">chevron_right</i>`;
            div.onclick = () => openProperty(docSnap.id);
            list.appendChild(div);
        }
    });
};

async function openProperty(docId) {
    currentPropertyId = docId;
    const docSnap = await getDoc(doc(db, "imoveis", docId));
    currentPropertyData = docSnap.data();
    document.getElementById('detail-title').innerText = currentPropertyData.rua;
    const list = document.getElementById('inspection-list');
    list.innerHTML = currentPropertyData.vistorias.length === 0 ? "<p style='padding:20px'>Sem vistorias.</p>" : "";
    currentPropertyData.vistorias.forEach((v, index) => {
        const div = document.createElement('div');
        div.className = 'inspection-item';
        div.innerHTML = `
            <div onclick="editInspection(${index})" style="flex-grow:1">
                <b>📅 ${new Date(v.date).toLocaleDateString()}</b><br><small>${v.user}</small>
            </div>
            <button class="delete-btn" onclick="event.stopPropagation(); window.deleteInspection(${index})"><i class="material-icons">delete</i></button>`;
        list.appendChild(div);
    });
    window.showScreen('screen-property-detail');
}

// --- 4. LÓGICA DE FOTOS ---
function createPhotoElement(url) {
    const div = document.createElement('div');
    div.className = 'photo-container';
    div.innerHTML = `<img src="${url}" class="thumb" data-url="${url}" onclick="window.open('${url}')"><div class="remove-photo-btn" onclick="this.parentElement.remove()">×</div>`;
    return div;
}

window.uploadToImgBB = async (input, containerId) => {
    const previewDiv = document.getElementById(containerId);
    for (let file of Array.from(input.files)) {
        const loader = document.createElement('div');
        loader.className = 'loading-thumb'; loader.innerText = 'Sobe...';
        previewDiv.appendChild(loader);
        const formData = new FormData(); formData.append("image", file);
        try {
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) previewDiv.replaceChild(createPhotoElement(data.data.url), loader);
            else loader.remove();
        } catch (e) { loader.remove(); }
    }
    input.value = "";
};

// --- 5. VISTORIAS ---
window.openNewInspection = () => {
    editingInspectionIndex = null;
    document.getElementById('ins-form-title').innerText = "Nova Vistoria";
    document.getElementById('ins-obs').value = "";
    document.getElementById('room-sections').innerHTML = "";
    document.getElementById('btn-pdf-in-form').style.display = "none";
    window.showScreen('screen-inspection-form');
};

window.editInspection = (index) => {
    editingInspectionIndex = index;
    const v = currentPropertyData.vistorias[index];
    document.getElementById('ins-form-title').innerText = "Editar Vistoria";
    document.getElementById('ins-obs').value = v.obs || "";
    document.getElementById('room-sections').innerHTML = "";
    document.getElementById('btn-pdf-in-form').style.display = "flex";
    v.rooms.forEach(room => window.addRoomSection(room.nome, room.fotos, room.obs));
    window.showScreen('screen-inspection-form');
};

window.addRoomSection = (nome = "", fotos = [], obs = "") => {
    const div = document.createElement('div');
    div.className = 'room-box';
    const cid = "c-" + Math.random().toString(36).substr(2, 9);
    div.innerHTML = `
        <input type="text" placeholder="Cômodo" value="${nome}" class="room-name">
        <textarea placeholder="Observações deste cômodo..." class="room-obs">${obs}</textarea>
        <div class="previews" id="${cid}"></div>
        <label class="upload-label">+ Fotos<input type="file" accept="image/*" multiple style="display:none" onchange="window.uploadToImgBB(this, '${cid}')"></label>
    `;
    document.getElementById('room-sections').appendChild(div);
    const prev = div.querySelector('.previews');
    fotos.forEach(url => prev.appendChild(createPhotoElement(url)));
};

window.processInspectionSave = async () => {
    const btn = document.getElementById('btnSaveIns');
    btn.disabled = true;
    const rooms = [];
    document.querySelectorAll('.room-box').forEach(box => {
        const photos = Array.from(box.querySelectorAll('img.thumb')).map(img => img.dataset.url);
        rooms.push({ nome: box.querySelector('.room-name').value || "Cômodo", obs: box.querySelector('.room-obs').value || "", fotos: photos });
    });
    let vists = [...currentPropertyData.vistorias];
    const data = {
        user: editingInspectionIndex !== null ? vists[editingInspectionIndex].user : currentUser,
        date: editingInspectionIndex !== null ? vists[editingInspectionIndex].date : Date.now(),
        obs: document.getElementById('ins-obs').value, rooms: rooms
    };
    if (editingInspectionIndex === null) vists.push(data);
    else vists[editingInspectionIndex] = data;
    try {
        await updateDoc(doc(db, "imoveis", currentPropertyId), { vistorias: vists });
        await openProperty(currentPropertyId);
    } catch (e) { alert("Erro ao salvar."); }
    btn.disabled = false;
};

// --- 6. PDF ---
const getImageData = (url) => new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'Anonymous';
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject; img.src = url;
});

window.generatePDF = async () => {
    if (editingInspectionIndex === null) return alert("Salve antes de gerar o laudo.");
    const v = currentPropertyData.vistorias[editingInspectionIndex];
    const btnPdf = document.getElementById('btn-pdf-in-form');
    btnPdf.innerText = "Processando...";
    
    try {
        const docPdf = new jsPDF();
        let y = 15; const margin = 15; const pageWidth = docPdf.internal.pageSize.getWidth();
        const checkPage = (h) => { if (y + h > 275) { docPdf.addPage(); y = 20; return true; } return false; };

        docPdf.setFontSize(16); docPdf.setFont("helvetica", "bold");
        docPdf.text("LAUDO DE VISTORIA", margin, y); y += 10;
        docPdf.setFontSize(10); docPdf.setFont("helvetica", "normal");
        const addr = `${currentPropertyData.rua}, ${currentPropertyData.numero} ${currentPropertyData.complemento || ''}\n${currentPropertyData.bairro}, ${currentPropertyData.cidade}`;
        docPdf.text(addr, margin, y); y += 15;
        docPdf.text(`Data: ${new Date(v.date).toLocaleDateString()} | Vistoriador: ${v.user}`, margin, y); y += 10;
        
        docPdf.setFont("helvetica", "bold"); docPdf.text("OBSERVAÇÕES GERAIS:", margin, y); y += 5;
        docPdf.setFont("helvetica", "normal");
        const lines = docPdf.splitTextToSize(v.obs || "Nenhuma.", pageWidth - 30);
        docPdf.text(lines, margin, y); y += (lines.length * 5) + 10;

        for (const r of v.rooms) {
            checkPage(20); docPdf.setFont("helvetica", "bold");
            docPdf.setFillColor(240, 240, 240); docPdf.rect(margin, y - 5, pageWidth - 30, 7, 'F');
            docPdf.text(r.nome.toUpperCase(), margin + 2, y); y += 10;
            if (r.obs) {
                docPdf.setFont("helvetica", "italic");
                const rLines = docPdf.splitTextToSize(`Obs: ${r.obs}`, pageWidth - 30);
                docPdf.text(rLines, margin, y); y += (rLines.length * 5) + 5;
            }
            const imgW = (pageWidth - 40) / 2; const imgH = 60;
            for (let i = 0; i < r.fotos.length; i += 2) {
                checkPage(imgH + 10);
                try {
                    const img1 = await getImageData(r.fotos[i]);
                    docPdf.addImage(img1, 'JPEG', margin, y, imgW, imgH);
                    if (r.fotos[i+1]) {
                        const img2 = await getImageData(r.fotos[i+1]);
                        docPdf.addImage(img2, 'JPEG', margin + imgW + 10, y, imgW, imgH);
                    }
                    y += imgH + 10;
                } catch (e) { y += 10; }
            }
            y += 5;
        }
        checkPage(50); y += 20;
        docPdf.line(margin, y, margin + 70, y); docPdf.line(pageWidth - margin - 70, y, pageWidth - margin, y);
        y += 5; docPdf.setFontSize(8);
        docPdf.text(v.user, margin, y); docPdf.text("CLIENTE:", pageWidth - margin - 70, y);
        
        const total = docPdf.internal.getNumberOfPages();
        for (let i = 1; i <= total; i++) {
            docPdf.setPage(i);
            docPdf.text(`Página ${i} de ${total}`, pageWidth / 2, 290, { align: "center" });
        }
        docPdf.save(`Laudo_${currentPropertyData.rua.replace(/ /g, '_')}.pdf`);
    } catch (e) { alert("Erro ao gerar PDF."); }
    btnPdf.innerHTML = `<i class="material-icons">description</i> Gerar Laudo PDF`;
};

window.deleteInspection = async (i) => {
    if (!confirm("Excluir vistoria permanentemente?")) return;
    let v = [...currentPropertyData.vistorias]; v.splice(i, 1);
    await updateDoc(doc(db, "imoveis", currentPropertyId), { vistorias: v });
    openProperty(currentPropertyId);
};
