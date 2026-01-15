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

let currentUser = "";
let currentPropertyId = "";
let currentPropertyData = null;
let editingInspectionIndex = null; // null = nova, número = index da edição

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

// --- 3. ENDEREÇO (ViaCEP) ---
window.searchCEP = async () => {
    const cepInput = document.getElementById('cep');
    const cep = cepInput.value.replace(/\D/g, '');
    if (cep.length === 8) {
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (!data.erro) {
                document.getElementById('rua').value = data.logradouro;
                document.getElementById('bairro').value = data.bairro;
                document.getElementById('cidade').value = data.localidade;
            } else {
                alert("CEP não encontrado.");
            }
        } catch (e) { console.error("Erro ViaCEP"); }
    }
};

// --- 4. GESTÃO DE IMÓVEIS ---
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

    if(!property.rua || !property.numero) return alert("Preencha o endereço completo.");

    btn.disabled = true;
    try {
        await addDoc(collection(db, "imoveis"), property);
        window.showScreen('screen-dashboard');
    } catch (e) { alert("Erro ao salvar imóvel."); }
    btn.disabled = false;
};

window.renderProperties = async () => {
    const list = document.getElementById('property-list');
    const search = document.getElementById('searchBar').value.toLowerCase();
    list.innerHTML = "<p style='padding:20px'>Carregando imóveis...</p>";

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
                <div>
                    <strong>${fullAddress}</strong><br>
                    <small>${p.bairro} - ${p.cidade}</small>
                </div>
                <i class="material-icons" style="color:#ccc">chevron_right</i>
            `;
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
    list.innerHTML = currentPropertyData.vistorias.length === 0 ? "<p style='padding:20px'>Nenhuma vistoria registrada.</p>" : "";

    currentPropertyData.vistorias.forEach((v, index) => {
        const div = document.createElement('div');
        div.className = 'inspection-item';
        div.innerHTML = `
            <div onclick="editInspection(${index})" style="flex-grow:1">
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

// --- 5. LÓGICA DE FOTOS (COM REMOVER E CARREGANDO) ---

// Cria o elemento da foto com o botão X
function createPhotoElement(url) {
    const div = document.createElement('div');
    div.className = 'photo-container';
    div.innerHTML = `
        <img src="${url}" class="thumb" data-url="${url}" onclick="window.open('${url}')">
        <div class="remove-photo-btn" onclick="this.parentElement.remove()">×</div>
    `;
    return div;
}

window.uploadToImgBB = async (input, containerId) => {
    const previewDiv = document.getElementById(containerId);
    const files = Array.from(input.files);
    
    for (let file of files) {
        // Adiciona placeholder de carregamento
        const loader = document.createElement('div');
        loader.className = 'loading-thumb';
        loader.innerText = 'Sobe...';
        previewDiv.appendChild(loader);

        const formData = new FormData();
        formData.append("image", file);

        try {
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
            const data = await res.json();
            
            if (data.success) {
                const photoEl = createPhotoElement(data.data.url);
                previewDiv.replaceChild(photoEl, loader); // Substitui carregando pela foto
            } else {
                loader.innerText = "Erro";
                setTimeout(() => loader.remove(), 2000);
            }
        } catch (e) {
            loader.innerText = "Erro";
            setTimeout(() => loader.remove(), 2000);
        }
    }
    input.value = ""; // Limpa para permitir subir o mesmo arquivo se quiser
};

// --- 6. VISTORIAS (NOVA E EDIÇÃO) ---

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
    document.getElementById('ins-obs').value = v.obs || "";
    const container = document.getElementById('room-sections');
    container.innerHTML = "";
    
    v.rooms.forEach(room => {
        window.addRoomSection(room.nome, room.fotos);
    });
    window.showScreen('screen-inspection-form');
};

window.addRoomSection = (nome = "", fotos = []) => {
    const div = document.createElement('div');
    div.className = 'room-box';
    const containerId = "container-" + Math.random().toString(36).substr(2, 9);
    
    div.innerHTML = `
        <input type="text" placeholder="Nome do Cômodo" value="${nome}" class="room-name">
        <div class="previews" id="${containerId}"></div>
        <label class="upload-label">
            <i class="material-icons" style="font-size:18px; vertical-align:middle">add_a_photo</i> 
            Adicionar Fotos
            <input type="file" accept="image/*" multiple style="display:none" onchange="uploadToImgBB(this, '${containerId}')">
        </label>
    `;
    document.getElementById('room-sections').appendChild(div);

    // Renderiza fotos existentes (se for edição)
    const previewDiv = div.querySelector('.previews');
    fotos.forEach(url => {
        previewDiv.appendChild(createPhotoElement(url));
    });
};

window.processInspectionSave = async () => {
    const btn = document.getElementById('btnSaveIns');
    btn.disabled = true;
    btn.innerText = "Salvando...";

    const rooms = [];
    document.querySelectorAll('.room-box').forEach(box => {
        // Coleta apenas as imagens que estão visíveis na tela (não removidas pelo X)
        const photos = Array.from(box.querySelectorAll('img.thumb')).map(img => img.dataset.url);
        rooms.push({ 
            nome: box.querySelector('.room-name').value || "Cômodo sem nome", 
            fotos: photos 
        });
    });

    let vistoriasAtualizadas = [...currentPropertyData.vistorias];
    
    const inspectionData = {
        user: editingInspectionIndex !== null ? vistoriasAtualizadas[editingInspectionIndex].user : currentUser,
        date: editingInspectionIndex !== null ? vistoriasAtualizadas[editingInspectionIndex].date : Date.now(),
        obs: document.getElementById('ins-obs').value,
        rooms: rooms
    };

    if (editingInspectionIndex === null) {
        vistoriasAtualizadas.push(inspectionData);
    } else {
        vistoriasAtualizadas[editingInspectionIndex] = inspectionData;
    }

    try {
        await updateDoc(doc(db, "imoveis", currentPropertyId), { vistorias: vistoriasAtualizadas });
        await openProperty(currentPropertyId);
    } catch (e) {
        alert("Erro ao salvar vistoria.");
        console.error(e);
    }
    
    btn.disabled = false;
    btn.innerText = "Salvar Vistoria";
};

window.deleteInspection = async (index) => {
    if (!confirm("Excluir esta vistoria permanentemente?")) return;
    
    let vistoriasAtualizadas = [...currentPropertyData.vistorias];
    vistoriasAtualizadas.splice(index, 1);

    try {
        await updateDoc(doc(db, "imoveis", currentPropertyId), { vistorias: vistoriasAtualizadas });
        openProperty(currentPropertyId);
    } catch (e) { alert("Erro ao excluir."); }
};
