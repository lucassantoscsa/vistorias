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

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = "";
let currentPropertyId = "";

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
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (!data.erro) {
                document.getElementById('rua').value = data.logradouro;
                document.getElementById('bairro').value = data.bairro;
                document.getElementById('cidade').value = data.localidade;
            }
        } catch (e) { alert("Erro ao buscar CEP"); }
    }
};

// --- SALVAR IMÓVEL ---
window.saveProperty = async () => {
    const btn = document.getElementById('btnSaveProp');
    const cep = document.getElementById('cep').value;
    const num = document.getElementById('numero').value;
    
    if(!cep || !num) return alert("Preencha CEP e Número");
    
    btn.disabled = true;
    btn.innerText = "Salvando...";

    const idCalculada = btoa(cep + num + Date.now()).substring(0, 8);

    const property = {
        customId: idCalculada,
        rua: document.getElementById('rua').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        numero: num,
        complemento: document.getElementById('complemento').value,
        createdAt: Date.now(),
        vistorias: []
    };

    try {
        await addDoc(collection(db, "imoveis"), property);
        window.showScreen('screen-dashboard');
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    btn.disabled = false;
    btn.innerText = "Salvar Imóvel";
};

// --- LISTAR IMÓVEIS ---
window.renderProperties = async () => {
    const list = document.getElementById('property-list');
    const search = document.getElementById('searchBar').value.toLowerCase();
    list.innerHTML = "<p>Carregando imóveis...</p>";

    const q = query(collection(db, "imoveis"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    list.innerHTML = "";
    querySnapshot.forEach((docSnap) => {
        const p = docSnap.data();
        if (p.rua.toLowerCase().includes(search)) {
            const div = document.createElement('div');
            div.className = 'property-item';
            div.innerHTML = `<strong>${p.rua}, ${p.numero}</strong><br><small>${p.bairro} - ID: ${p.customId}</small>`;
            div.onclick = () => openProperty(docSnap.id);
            list.appendChild(div);
        }
    });
};

// --- DETALHES ---
async function openProperty(docId) {
    currentPropertyId = docId;
    const docSnap = await getDoc(doc(db, "imoveis", docId));
    const p = docSnap.data();
    
    document.getElementById('detail-title').innerText = p.rua;
    const list = document.getElementById('inspection-list');
    list.innerHTML = p.vistorias.length === 0 ? "<p>Nenhuma vistoria registrada.</p>" : "";

    p.vistorias.sort((a,b) => b.date - a.date).forEach(v => {
        const div = document.createElement('div');
        div.className = 'inspection-item';
        div.innerHTML = `<b>📅 ${new Date(v.date).toLocaleDateString()}</b><br>Vistoriador: ${v.user}`;
        list.appendChild(div);
    });
    window.showScreen('screen-property-detail');
}

// --- VISTORIAS E FOTOS (IMGBB) ---
window.openNewInspection = () => {
    document.getElementById('room-sections').innerHTML = "";
    document.getElementById('ins-obs').value = "";
    window.showScreen('screen-inspection-form');
};

window.addRoomSection = () => {
    const div = document.createElement('div');
    div.className = 'room-box';
    div.innerHTML = `
        <input type="text" placeholder="Nome do Cômodo (Ex: Quarto 1)">
        <input type="file" accept="image/*" multiple onchange="uploadToImgBB(this)">
        <div class="previews"></div>
    `;
    document.getElementById('room-sections').appendChild(div);
};

window.uploadToImgBB = async (input) => {
    const previewDiv = input.nextElementSibling;
    const files = Array.from(input.files);
    input.disabled = true;
    
    for (let file of files) {
        const formData = new FormData();
        formData.append("image", file);

        try {
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                const img = document.createElement('img');
                img.src = data.data.url;
                img.className = 'thumb';
                img.dataset.url = data.data.url;
                previewDiv.appendChild(img);
            }
        } catch (e) { console.error("Erro upload"); }
    }
    input.disabled = false;
};

window.saveInspection = async () => {
    const btn = document.getElementById('btnSaveIns');
    btn.innerText = "Salvando Vistoria...";
    btn.disabled = true;

    const rooms = [];
    document.querySelectorAll('.room-box').forEach(box => {
        const photos = Array.from(box.querySelectorAll('.thumb')).map(img => img.dataset.url);
        rooms.push({
            nome: box.querySelector('input').value,
            fotos: photos
        });
    });

    const newInspection = {
        user: currentUser,
        date: Date.now(),
        obs: document.getElementById('ins-obs').value,
        rooms: rooms
    };

    try {
        await updateDoc(doc(db, "imoveis", currentPropertyId), {
            vistorias: arrayUnion(newInspection)
        });
        openProperty(currentPropertyId);
    } catch (e) { alert("Erro ao salvar vistoria"); }
    
    btn.innerText = "Finalizar e Salvar";
    btn.disabled = false;
};
