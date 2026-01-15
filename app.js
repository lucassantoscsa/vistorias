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


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = "";
let currentPropertyId = "";
let currentPropertyData = null;
let editingInspectionIndex = null; // null = nova, numero = editando

// --- NAVEGAÇÃO ---
window.showScreen = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    if(screenId === 'screen-dashboard') window.renderProperties();
};

window.login = (user) => {
    currentUser = user;
    window.showScreen('screen-dashboard');
};

// --- BUSCA CEP ---
window.searchCEP = async () => {
    const cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length === 8) {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro) {
            document.getElementById('rua').value = data.logradouro;
            document.getElementById('bairro').value = data.bairro;
            document.getElementById('cidade').value = data.localidade;
        }
    }
};

// --- IMÓVEIS ---
window.saveProperty = async () => {
    const property = {
        rua: document.getElementById('rua').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        numero: document.getElementById('numero').value,
        complemento: document.getElementById('complemento').value,
        createdAt: Date.now(),
        vistorias: []
    };
    await addDoc(collection(db, "imoveis"), property);
    window.showScreen('screen-dashboard');
};

window.renderProperties = async () => {
    const list = document.getElementById('property-list');
    const search = document.getElementById('searchBar').value.toLowerCase();
    list.innerHTML = "Carregando...";
    const q = query(collection(db, "imoveis"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    list.innerHTML = "";
    querySnapshot.forEach((docSnap) => {
        const p = docSnap.data();
        const addr = `${p.rua}, ${p.numero} ${p.complemento || ''}`;
        if (addr.toLowerCase().includes(search)) {
            const div = document.createElement('div');
            div.className = 'property-item';
            div.innerHTML = `<div><strong>${addr}</strong><br><small>${p.bairro}</small></div>`;
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
    list.innerHTML = currentPropertyData.vistorias.length === 0 ? "Nenhuma vistoria." : "";
    currentPropertyData.vistorias.forEach((v, index) => {
        const div = document.createElement('div');
        div.className = 'inspection-item';
        div.innerHTML = `
            <div onclick="editInspection(${index})" style="flex-grow:1">
                <b>📅 ${new Date(v.date).toLocaleDateString()}</b> - ${v.user}
            </div>
            <button class="delete-btn" onclick="deleteInspection(${index})"><i class="material-icons">delete</i></button>
        `;
        list.appendChild(div);
    });
    window.showScreen('screen-property-detail');
}

// --- VISTORIAS ---
window.openNewInspection = () => {
    editingInspectionIndex = null;
    document.getElementById('ins-form-title').innerText = "Nova Vistoria";
    document.getElementById('ins-obs').value = "";
    document.getElementById('room-sections').innerHTML = "";
    window.showScreen('screen-inspection-form');
};

window.editInspection = (index) => {
    editingInspectionIndex = index;
    const v = currentPropertyData.vistorias[index];
    document.getElementById('ins-form-title').innerText = "Editar Vistoria";
    document.getElementById('ins-obs').value = v.obs;
    const container = document.getElementById('room-sections');
    container.innerHTML = "";
    v.rooms.forEach(room => {
        addRoomSection(room.nome, room.fotos);
    });
    window.showScreen('screen-inspection-form');
};

window.addRoomSection = (nome = "", fotos = []) => {
    const div = document.createElement('div');
    div.className = 'room-box';
    let fotosHtml = fotos.map(url => `<img src="${url}" class="thumb" data-url="${url}" onclick="window.open('${url}')">`).join('');
    div.innerHTML = `
        <input type="text" placeholder="Nome do Cômodo" value="${nome}" class="room-name">
        <div class="previews">${fotosHtml}</div>
        <label class="upload-label">
            + Adicionar Fotos
            <input type="file" accept="image/*" multiple style="display:none" onchange="uploadToImgBB(this)">
        </label>
    `;
    document.getElementById('room-sections').appendChild(div);
};

window.uploadToImgBB = async (input) => {
    const previewDiv = input.parentElement.previousElementSibling;
    const files = Array.from(input.files);
    input.disabled = true;
    for (let file of files) {
        const formData = new FormData();
        formData.append("image", file);
        try {
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) {
                const img = document.createElement('img');
                img.src = data.data.url;
                img.className = 'thumb';
                img.dataset.url = data.data.url;
                previewDiv.appendChild(img);
            }
        } catch (e) { alert("Erro no upload"); }
    }
    input.disabled = false;
};

window.processInspectionSave = async () => {
    const btn = document.getElementById('btnSaveIns');
    btn.disabled = true;
    btn.innerText = "Salvando...";

    const rooms = [];
    document.querySelectorAll('.room-box').forEach(box => {
        const photos = Array.from(box.querySelectorAll('.thumb')).map(img => img.dataset.url);
        rooms.push({ nome: box.querySelector('.room-name').value, fotos: photos });
    });

    let updatedVistorias = [...currentPropertyData.vistorias];
    
    if (editingInspectionIndex === null) {
        // Nova Vistoria
        updatedVistorias.push({ user: currentUser, date: Date.now(), obs: document.getElementById('ins-obs').value, rooms: rooms });
    } else {
        // Editar Existente
        updatedVistorias[editingInspectionIndex] = {
            ...updatedVistorias[editingInspectionIndex],
            obs: document.getElementById('ins-obs').value,
            rooms: rooms
        };
    }

    try {
        await updateDoc(doc(db, "imoveis", currentPropertyId), { vistorias: updatedVistorias });
        openProperty(currentPropertyId);
    } catch (e) { alert("Erro ao salvar"); }
    
    btn.disabled = false;
    btn.innerText = "Salvar Vistoria";
};

window.deleteInspection = async (index) => {
    if (!confirm("Excluir esta vistoria?")) return;
    let updatedVistorias = [...currentPropertyData.vistorias];
    updatedVistorias.splice(index, 1);
    await updateDoc(doc(db, "imoveis", currentPropertyId), { vistorias: updatedVistorias });
    openProperty(currentPropertyId);
};
