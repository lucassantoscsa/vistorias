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

// --- SALVAR IMÓVEL ---
window.saveProperty = async () => {
    const btn = document.getElementById('btnSaveProp');
    const property = {
        rua: document.getElementById('rua').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        numero: document.getElementById('numero').value,
        complemento: document.getElementById('complemento').value,
        createdAt: Date.now(),
        vistorias: []
    };

    if(!property.rua || !property.numero) return alert("Preencha o endereço");

    btn.disabled = true;
    await addDoc(collection(db, "imoveis"), property);
    window.showScreen('screen-dashboard');
    btn.disabled = false;
};

// --- LISTAR IMÓVEIS (Endereço Completo) ---
window.renderProperties = async () => {
    const list = document.getElementById('property-list');
    const search = document.getElementById('searchBar').value.toLowerCase();
    list.innerHTML = "Carregando...";

    const q = query(collection(db, "imoveis"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    list.innerHTML = "";
    querySnapshot.forEach((docSnap) => {
        const p = docSnap.data();
        const fullAddress = `${p.rua}, ${p.numero} ${p.complemento ? '('+p.complemento+')' : ''}`;
        
        if (fullAddress.toLowerCase().includes(search)) {
            const div = document.createElement('div');
            div.className = 'property-item';
            div.innerHTML = `
                <strong>${fullAddress}</strong><br>
                <small>${p.bairro} - ${p.cidade}</small>
            `;
            div.onclick = () => openProperty(docSnap.id);
            list.appendChild(div);
        }
    });
};

// --- GESTÃO DO IMÓVEL (Listar com Exclusão) ---
async function openProperty(docId) {
    currentPropertyId = docId;
    const docSnap = await getDoc(doc(db, "imoveis", docId));
    currentPropertyData = docSnap.data();
    
    document.getElementById('detail-title').innerText = currentPropertyData.rua;
    const list = document.getElementById('inspection-list');
    list.innerHTML = currentPropertyData.vistorias.length === 0 ? "<p>Nenhuma vistoria.</p>" : "";

    currentPropertyData.vistorias.sort((a,b) => b.date - a.date).forEach((v, index) => {
        const div = document.createElement('div');
        div.className = 'inspection-item';
        div.innerHTML = `
            <div onclick="viewInspection(${index})" style="flex-grow:1">
                <b>📅 ${new Date(v.date).toLocaleDateString()}</b><br>
                <small>Vistoriador: ${v.user}</small>
            </div>
            <button class="delete-btn" onclick="deleteInspection(${index})">
                <i class="material-icons">delete</i>
            </button>
        `;
        list.appendChild(div);
    });
    window.showScreen('screen-property-detail');
}

// --- EXCLUIR VISTORIA ---
window.deleteInspection = async (index) => {
    if (!confirm("Deseja realmente excluir esta vistoria?")) return;
    
    const updatedVistorias = [...currentPropertyData.vistorias];
    updatedVistorias.splice(index, 1); // Remove a vistoria pelo índice

    await updateDoc(doc(db, "imoveis", currentPropertyId), {
        vistorias: updatedVistorias
    });
    openProperty(currentPropertyId); // Atualiza a tela
};

// --- VISUALIZAR DETALHES DA VISTORIA ---
window.viewInspection = (index) => {
    const v = currentPropertyData.vistorias[index];
    const content = document.getElementById('view-inspection-content');
    
    let roomsHtml = "";
    v.rooms.forEach(room => {
        let photosHtml = "";
        room.fotos.forEach(url => {
            photosHtml += `<img src="${url}" class="thumb" onclick="window.open('${url}')">`;
        });
        roomsHtml += `
            <div class="room-view">
                <h3>${room.nome || 'Cômodo sem nome'}</h3>
                <div>${photosHtml}</div>
            </div>
        `;
    });

    content.innerHTML = `
        <div class="obs-view">
            <strong>Observações:</strong><br>
            ${v.obs || 'Sem observações.'}
        </div>
        <p><small>Realizada por: ${v.user} em ${new Date(v.date).toLocaleString()}</small></p>
        <hr>
        ${roomsHtml}
    `;
    window.showScreen('screen-view-inspection');
};

// --- CADASTRAR NOVA VISTORIA ---
window.openNewInspection = () => {
    document.getElementById('room-sections').innerHTML = "";
    document.getElementById('ins-obs').value = "";
    window.showScreen('screen-inspection-form');
};

window.addRoomSection = () => {
    const div = document.createElement('div');
    div.className = 'room-box';
    div.innerHTML = `
        <input type="text" placeholder="Cômodo (Ex: Banheiro Social)">
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

window.saveInspection = async () => {
    const btn = document.getElementById('btnSaveIns');
    btn.disabled = true;

    const rooms = [];
    document.querySelectorAll('.room-box').forEach(box => {
        const photos = Array.from(box.querySelectorAll('.thumb')).map(img => img.dataset.url);
        rooms.push({ nome: box.querySelector('input').value, fotos: photos });
    });

    const newIns = { user: currentUser, date: Date.now(), obs: document.getElementById('ins-obs').value, rooms: rooms };

    await updateDoc(doc(db, "imoveis", currentPropertyId), {
        vistorias: [...currentPropertyData.vistorias, newIns]
    });
    
    btn.disabled = false;
    openProperty(currentPropertyId);
};

let editingInspectionIndex = null; // Para saber qual vistoria estamos editando

// --- VISUALIZAR E EDITAR VISTORIA EXISTENTE ---
window.viewInspection = (index) => {
    editingInspectionIndex = index;
    const v = currentPropertyData.vistorias[index];
    
    // Preenche a observação
    document.getElementById('edit-ins-obs').value = v.obs || "";
    
    const container = document.getElementById('edit-room-sections');
    container.innerHTML = "";

    // Renderiza cada cômodo da vistoria para edição
    v.rooms.forEach((room, roomIdx) => {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'room-view room-box-edit';
        
        let photosHtml = "";
        room.fotos.forEach(url => {
            photosHtml += `<img src="${url}" class="thumb" onclick="window.open('${url}')">`;
        });

        roomDiv.innerHTML = `
            <input type="text" value="${room.nome}" placeholder="Nome do cômodo" class="edit-room-name">
            <div class="previews-edit">${photosHtml}</div>
            <label class="add-photo-btn">
                + Adicionar Fotos
                <input type="file" accept="image/*" multiple style="display:none" onchange="uploadToImgBB(this)">
            </label>
        `;
        container.appendChild(roomDiv);
    });

    window.showScreen('screen-view-inspection');
};

// --- ADICIONAR NOVO CÔMODO DENTRO DA EDIÇÃO ---
window.addRoomSectionEdit = () => {
    const div = document.createElement('div');
    div.className = 'room-view room-box-edit';
    div.innerHTML = `
        <input type="text" placeholder="Nome do Novo Cômodo" class="edit-room-name">
        <div class="previews-edit"></div>
        <label class="add-photo-btn">
            + Adicionar Fotos
            <input type="file" accept="image/*" multiple style="display:none" onchange="uploadToImgBB(this)">
        </label>
    `;
    document.getElementById('edit-room-sections').appendChild(div);
};

// --- SALVAR ALTERAÇÕES NA VISTORIA ---
window.saveInspectionChanges = async () => {
    const btn = document.getElementById('btnUpdateIns');
    btn.innerText = "Salvando...";
    btn.disabled = true;

    // Coleta os dados editados da tela
    const updatedRooms = [];
    document.querySelectorAll('.room-box-edit').forEach(box => {
        const photos = Array.from(box.querySelectorAll('.thumb')).map(img => img.dataset.url);
        updatedRooms.push({
            nome: box.querySelector('.edit-room-name').value,
            fotos: photos
        });
    });

    // Cria a cópia do array de vistorias e atualiza o item específico
    const allVistorias = [...currentPropertyData.vistorias];
    allVistorias[editingInspectionIndex] = {
        ...allVistorias[editingInspectionIndex], // Mantém data e vistoriador original
        obs: document.getElementById('edit-ins-obs').value,
        rooms: updatedRooms
    };

    try {
        await updateDoc(doc(db, "imoveis", currentPropertyId), {
            vistorias: allVistorias
        });
        alert("Vistoria atualizada com sucesso!");
        openProperty(currentPropertyId); // Volta para a tela do imóvel
    } catch (e) {
        alert("Erro ao atualizar: " + e.message);
    }

    btn.innerText = "Salvar Alterações";
    btn.disabled = false;
};

// REAPROVEITANDO A FUNÇÃO DE UPLOAD (Ajustada para funcionar em ambas as telas)
window.uploadToImgBB = async (input) => {
    // Busca a div de preview que está antes ou depois do input (depende da tela)
    const previewDiv = input.parentElement.previousElementSibling || input.nextElementSibling;
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
