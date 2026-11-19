import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  Timestamp,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBi7iASsbv3-mS9QVrh5WFtMibRNIcgbcg",
  authDomain: "sistem-rp.firebaseapp.com",
  projectId: "sistem-rp",
  storageBucket: "sistem-rp.firebasestorage.app",
  messagingSenderId: "497963239400",
  appId: "1:497963239400:web:2955c4e0ca5a81af90865d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const DIAS_GESTAO = 120;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function formatarDataBR(ts) {
  if (!ts) return "-";
  const data = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleDateString("pt-BR");
}

export function calcularDiasRestantes(expiraEm) {
  if (!expiraEm) return 0;
  const msFim = typeof expiraEm.toMillis === "function" ? expiraEm.toMillis() : Number(expiraEm);
  const diff = msFim - Date.now();
  return Math.max(0, Math.ceil(diff / MS_POR_DIA));
}

export async function criarEntradaGestao(colecao, dados, dias = DIAS_GESTAO) {
  try {
    const agoraMs = Date.now();
    const expiraMs = agoraMs + dias * MS_POR_DIA;

    const docRef = await addDoc(collection(db, colecao), {
      ...dados,
      statusCiclo: "ativo",
      diasCiclo: dias,
      criadoEm: Timestamp.fromMillis(agoraMs),
      expiraEm: Timestamp.fromMillis(expiraMs),
      atualizadoEm: serverTimestamp()
    });

    return { ok: true, id: docRef.id };
  } catch (erro) {
    console.error(`[Firestore - criarEntradaGestao(${colecao})]:`, erro);
    return { ok: false, erro: erro.message };
  }
}

export function escutarGestaoAtiva(colecao, callback) {
  try {
    const agora = Timestamp.now();
    const q = query(
      collection(db, colecao),
      where("expiraEm", ">", agora),
      orderBy("expiraEm", "desc")
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((d) => {
          const item = d.data();
          return {
            id: d.id,
            ...item,
            diasRestantes: calcularDiasRestantes(item.expiraEm),
            dataCriacaoBR: formatarDataBR(item.criadoEm),
            dataFimBR: formatarDataBR(item.expiraEm)
          };
        });
        callback(lista);
      },
      (erro) => {
        console.error(`[Firestore - escutarGestaoAtiva(${colecao})]:`, erro);
      }
    );
  } catch (erro) {
    console.error(`[Firestore - montar escutarGestaoAtiva(${colecao})]:`, erro);
    return () => {};
  }
}

export async function listarArquivoMorto(colecao, maxItens = 50) {
  try {
    const agora = Timestamp.now();
    const q = query(
      collection(db, colecao),
      where("expiraEm", "<=", agora),
      orderBy("expiraEm", "desc"),
      limit(maxItens)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const item = d.data();
      return {
        id: d.id,
        ...item,
        diasRestantes: 0,
        dataCriacaoBR: formatarDataBR(item.criadoEm),
        dataFimBR: formatarDataBR(item.expiraEm)
      };
    });
  } catch (erro) {
    console.error(`[Firestore - listarArquivoMorto(${colecao})]:`, erro);
    return [];
  }
}

export async function renovarCicloGestao(colecao, id, dias = DIAS_GESTAO) {
  try {
    const novoFim = Timestamp.fromMillis(Date.now() + dias * MS_POR_DIA);
    await updateDoc(doc(db, colecao, String(id)), {
      expiraEm: novoFim,
      diasCiclo: dias,
      statusCiclo: "ativo",
      atualizadoEm: serverTimestamp()
    });
    return { ok: true };
  } catch (erro) {
    console.error(`[Firestore - renovarCicloGestao(${colecao}/${id})]:`, erro);
    return { ok: false, erro: erro.message };
  }
}

export async function criarRegistro(colecao, dados) {
  try {
    const docRef = await addDoc(collection(db, colecao), {
      ...dados,
      criadoEm: serverTimestamp()
    });
    return { ok: true, id: docRef.id };
  } catch (erro) {
    console.error(`[Firestore - criarRegistro(${colecao})]:`, erro);
    return { ok: false, erro: erro.message };
  }
}

export async function salvarComId(colecao, id, dados) {
  try {
    await setDoc(
      doc(db, colecao, String(id)),
      {
        ...dados,
        atualizadoEm: serverTimestamp()
      },
      { merge: true }
    );
    return { ok: true, id };
  } catch (erro) {
    console.error(`[Firestore - salvarComId(${colecao}/${id})]:`, erro);
    return { ok: false, erro: erro.message };
  }
}

export async function buscarPorId(colecao, id) {
  try {
    const snap = await getDoc(doc(db, colecao, String(id)));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (erro) {
    console.error(`[Firestore - buscarPorId(${colecao}/${id})]:`, erro);
    return null;
  }
}

export async function listarRegistros(colecao) {
  try {
    const snapshot = await getDocs(collection(db, colecao));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (erro) {
    console.error(`[Firestore - listarRegistros(${colecao})]:`, erro);
    return [];
  }
}

export async function filtrarRegistros(colecao, campo, operador, valor) {
  try {
    const q = query(collection(db, colecao), where(campo, operador, valor));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (erro) {
    console.error(`[Firestore - filtrarRegistros(${colecao})]:`, erro);
    return [];
  }
}

export async function listarOrdenado(colecao, campoOrdem = "criadoEm", direcao = "desc", maxItens = null) {
  try {
    const partes = [orderBy(campoOrdem, direcao)];
    if (maxItens) partes.push(limit(maxItens));

    const q = query(collection(db, colecao), ...partes);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (erro) {
    console.error(`[Firestore - listarOrdenado(${colecao})]:`, erro);
    return [];
  }
}

export function escutarRegistros(colecao, callback) {
  try {
    return onSnapshot(
      collection(db, colecao),
      (snapshot) => {
        const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(lista);
      },
      (erro) => {
        console.error(`[Firestore - escutarRegistros(${colecao})]:`, erro);
      }
    );
  } catch (erro) {
    console.error(`[Firestore - montar escutarRegistros(${colecao})]:`, erro);
    return () => {};
  }
}

export async function atualizarRegistro(colecao, id, novosDados) {
  try {
    await updateDoc(doc(db, colecao, String(id)), {
      ...novosDados,
      atualizadoEm: serverTimestamp()
    });
    return { ok: true };
  } catch (erro) {
    console.error(`[Firestore - atualizarRegistro(${colecao}/${id})]:`, erro);
    return { ok: false, erro: erro.message };
  }
}

export async function apagarRegistro(colecao, id) {
  try {
    await deleteDoc(doc(db, colecao, String(id)));
    return { ok: true };
  } catch (erro) {
    console.error(`[Firestore - apagarRegistro(${colecao}/${id})]:`, erro);
    return { ok: false, erro: erro.message };
  }
}

export async function salvarEmLote(colecao, itens = []) {
  try {
    const batch = writeBatch(db);
    for (const item of itens) {
      const ref = item.id ? doc(db, colecao, String(item.id)) : doc(collection(db, colecao));
      batch.set(
        ref,
        {
          ...item.dados,
          atualizadoEm: serverTimestamp()
        },
        { merge: true }
      );
    }
    await batch.commit();
    return { ok: true, total: itens.length };
  } catch (erro) {
    console.error(`[Firestore - salvarEmLote(${colecao})]:`, erro);
    return { ok: false, erro: erro.message };
  }
}

export async function apagarEmLote(colecao, ids = []) {
  try {
    const batch = writeBatch(db);
    for (const id of ids) {
      batch.delete(doc(db, colecao, String(id)));
    }
    await batch.commit();
    return { ok: true, total: ids.length };
  } catch (erro) {
    console.error(`[Firestore - apagarEmLote(${colecao})]:`, erro);
    return { ok: false, erro: erro.message };
  }
}
