// ==========================================
// 1. SECCIÓN: NÚCLEO (MÓDULOS BAILEYS)
// ==========================================
const crypto = require('crypto'); 
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('YakBot está vivo y operando 🚀'));

app.listen(port, () => {
    console.log(`✅ Servidor de validación escuchando en el puerto ${port}`);
});

// Importación única y total de la librería
const Baileys = require('@whiskeysockets/baileys');

// Extraemos las funciones directamente del objeto Baileys
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeInMemoryStore, // <--- Baileys lo exporta directamente aquí en versiones nuevas
    jidDecode, 
    getContentType,
    downloadContentFromMessage 
} = Baileys;

const { Boom } = require('@hapi/boom');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { exec } = require('child_process');

// CREACIÓN DEL STORE
// Si por algún motivo no existe en Baileys, usamos un objeto vacío para que el bot no crashee
const store = typeof makeInMemoryStore === 'function' 
    ? makeInMemoryStore({ logger: P().child({ level: 'silent', stream: 'store' }) }) 
    : { bind: () => {}, writeToFile: () => {}, readFromFile: () => {} };

console.log("DEBUG: La URL de Mongo empieza con:", process.env.MONGODB_URL ? process.env.MONGODB_URL.substring(0, 10) : "NADA");
// ==========================================
// 2. SECCIÓN: ESQUEMAS DE MONGODB
// ==========================================
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    dinero: { type: Number, default: 5000 },
    harem: { type: Array, default: [] },
    logros: { type: Array, default: [] },
    reacciones: { type: Number, default: 0 },
    stats: {
        rws: { type: Number, default: 0 },
        claims: { type: Number, default: 0 },
        duelosGanados: { type: Number, default: 0 }
    },
    cooldowns: { type: Object, default: {} },
    lastDaily: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);


// ==========================================
// 3. SECCIÓN: VARIABLES GLOBALES Y GIFS
// ==========================================
const prefix = '?';
const adminID = '232246195839008@s.whatsapp.net'; // Formato Baileys

// Bases de datos temporales (RAM)
const duelosActivos = {};
const tradesPendientes = {};
const mobActual = {};
const cooldownsBuscarmob = {};
const procesandoRW = new Set();

// Carga de JSONs
let personajes = [];
let mobsData = [];
try {
    personajes = JSON.parse(fs.readFileSync('./personajes.json', 'utf-8'));
    mobsData = JSON.parse(fs.readFileSync('./mobs.json', 'utf-8'));
    console.log(`✅ Recursos listos: ${personajes.length} PJs y ${mobsData.length} Mobs.`);
} catch (e) {
    console.error("❌ Error en carga de JSON:", e);
}

// Mapa de Gifs para reacciones
const animeGifs = {};
const categorias = ['cry', 'hug', 'kiss', 'punch', 'kill', 'pat', 'happy', 'sad', 'angry', 'laugh', 'dance', 'scared', 'eat', 'sleep', 'cafe', 'run', 'preg'];

categorias.forEach(cat => {
    const dir = `./Gifs/${cat}`;
    if (fs.existsSync(dir)) {
        animeGifs[cat] = fs.readdirSync(dir).map(f => `Gifs/${cat}/${f}`);
    }
});

// ==========================================
// 4. SECCIÓN: FUNCIONES DE APOYO
// ==========================================

function actualizarStamina(personaje) {
    const ahora = Date.now();
    const tiempoPasado = ahora - (personaje.lastUpdate || ahora);
    const regeneracion = Math.floor(tiempoPasado / 600000) * 5; // 5% cada 10 min
    if (regeneracion > 0) {
        personaje.stamina = Math.min(100, (personaje.stamina || 0) + regeneracion);
        personaje.lastUpdate = ahora;
    }
}

// Helper para decodificar JIDs (Nombres de usuario)
const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return decode.user && decode.server && decode.user + '@' + decode.server || jid;
    } else return jid;
};


// ==========================================
// 5. SECCIÓN: DONDE ARRANCA EL BOT
// ==========================================
async function iniciarBot() {
    // 1. Gestión de sesión (Multi-File Auth) - Usamos la ruta que ya tienes
    const { state, saveCreds } = await useMultiFileAuthState('./Data/session_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false, // Desactivado para que no rompa el log de Render
        auth: state,
        browser: ['Ubuntu', 'Chrome', '20.0.0'], // Crucial para Pairing Code
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg?.message || undefined;
            }
            return { conversation: "YakBot Online" };
        }
    });

    // Enlazar el store al socket
    if (store && store.bind) store.bind(sock.ev);

    // --- LÓGICA DE PAIRING CODE MEJORADA ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = '5214772025939'; // Tu número ya configurado
        
        console.log(`⏳ Generando código de vinculación para: ${phoneNumber}...`);
        
        // Esperamos 6 segundos para que el socket esté "caliente" y no suelte 'Connection Closed'
        setTimeout(async () => {
            try {
                const codigo = await sock.requestPairingCode(phoneNumber);
                console.log(`\n=========================================`);
                console.log(`🔑 TU CÓDIGO DE VINCULACIÓN ES: ${codigo}`);
                console.log(`=========================================\n`);
            } catch (err) {
                console.error("❌ Error al pedir pairing code:", err);
            }
        }, 6000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const code = (lastDisconnect.error instanceof Boom)?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            console.log(`📡 Conexión cerrada (${code}). Reconectando: ${shouldReconnect}`);
            if (shouldReconnect) iniciarBot();
        } else if (connection === 'open') {
            console.log('✅ YakBot Baileys: CONECTADO Y LISTO');
        }
    });

    // 2. Conexión a MongoDB (Usando la variable de Render)
    // Movido aquí abajo para que no bloquee el arranque del socket
    const mongoURI = process.env.MONGODB_URL;
    if (mongoURI) {
        mongoose.connect(mongoURI)
            .then(() => console.log("✅ Conectado a MongoDB Atlas"))
            .catch(err => {
                console.error("❌ Error Mongo (Verifica el link en Render):", err.message);
            });
    } else {
        console.error("❌ ERROR: La variable MONGODB_URL no está definida en Render.");
    }

    // Pasamos el socket al Bloque 10
    escuchadorMensajes(sock);
}

// ==========================================
// 6. SECCIÓN: LÓGICA DE PERSONAJES Y TIENDA
// ==========================================
function actualizarHarem(harem) {
    harem.forEach(p => actualizarStamina(p));
}

// Función para generar la tienda del día (si la usas)
function generarTienda() {
    const shuffle = [...personajes].sort(() => 0.5 - Math.random());
    return shuffle.slice(0, 5);
}

// ==========================================
// 7. SECCIÓN: LÓGICA DE PERSONAJES Y EVOLUCIÓN
// ==========================================

/**
 * Procesa la evolución de un personaje si cumple los requisitos.
 * @param {Object} p - El objeto del personaje en el harem.
 * @returns {Object} - Objeto con el resultado (si evolucionó o no).
 */
function procesarEvolucion(p) {
    if (!p.evolucion || !p.nivelEvo) return { evoluciono: false };

    if (p.level >= p.nivelEvo) {
        // Buscamos los datos del nuevo personaje en nuestro array global 'personajes'
        const datosEvo = personajes.find(pe => pe.nombre.toLowerCase() === p.evolucion.toLowerCase());
        
        if (datosEvo) {
            const nombreAnterior = p.nombre;
            p.nombre = datosEvo.nombre;
            p.imagen = datosEvo.imagen;
            p.valor = datosEvo.valor;
            p.fuente = datosEvo.fuente || p.fuente;
            // Si la nueva forma tiene otra evolución, la seteamos, si no, null
            p.evolucion = datosEvo.evolucion || null;
            p.nivelEvo = datosEvo.nivelEvo || null;
            
            return { 
                evoluciono: true, 
                anterior: nombreAnterior, 
                actual: p.nombre 
            };
        }
    }
    return { evoluciono: false };
}

/**
 * Busca un personaje en el harem de un usuario por nombre y grupo.
 */
function buscarPjEnHarem(user, nombre, grupoId) {
    return user.harem.find(p => 
        p.nombre.toLowerCase() === nombre.toLowerCase() && 
        p.grupoId === grupoId
    );
}

// ==========================================
// 9. SECCIÓN: HELPERS DE PROBABILIDAD
// ==========================================
function obtenerPersonajeRandom() {
    const listaPesos = personajes.map(p => {
        const v = parseInt(p.valor) || 1000;
        let pesoFinal = (v >= 17000) ? 100 / Math.pow(v / 17000, 2.5) : 100;
        return { p, peso: pesoFinal };
    });

    const sumaPesosTotal = listaPesos.reduce((s, i) => s + i.peso, 0);
    let randomNum = Math.random() * sumaPesosTotal;

    for (const item of listaPesos) {
        randomNum -= item.peso;
        if (randomNum <= 0) return item.p;
    }
    return personajes[Math.floor(Math.random() * personajes.length)];
}

// ==========================================
// 10. SECCIÓN: MANEJADOR DE MENSAJES (MÉDULA ESPINAL)
// ==========================================
function escuchadorMensajes(sock) {
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;

            // --- VARIABLES DE IDENTIFICACIÓN ---
            const jid = m.key.remoteJid;
            const userId = decodeJid(m.key.participant || m.key.remoteJid);
            const isGroup = jid.endsWith('@g.us');
            const botNumber = decodeJid(sock.user.id);
            
            // Extraer el texto del mensaje
            const type = getContentType(m.message);
            const content = type === 'conversation' ? m.message.conversation : 
                            type === 'extendedTextMessage' ? m.message.extendedTextMessage.text : 
                            type === 'imageMessage' ? m.message.imageMessage.caption : 
                            type === 'videoMessage' ? m.message.videoMessage.caption : 
                            type === 'buttonsResponseMessage' ? m.message.buttonsResponseMessage.selectedButtonId : 
                            type === 'listResponseMessage' ? m.message.listResponseMessage.singleSelectReply.selectedRowId : 
                            type === 'templateButtonReplyMessage' ? m.message.templateButtonReplyMessage.selectedId : '';

            // Detectar comando
            const isCmd = content.startsWith(prefix);
            if (!isCmd) return;

            // REGLA DE ORO: Si el mensaje es mío, solo sigo si es un comando
            // Esto evita que el bot se responda a sí mismo infinitamente
            if (m.key.fromMe && !content.startsWith(prefix)) return;

            // Preparar comando y argumentos
            const args = content.slice(prefix.length).trim().split(/ +/);
            const comando = args.shift().toLowerCase();

            // --- METADATOS DE GRUPO ---
            const groupMetadata = isGroup ? await sock.groupMetadata(jid) : null;
            const participants = isGroup ? groupMetadata.participants : [];
            const pushname = m.pushName || 'Usuario';

            const getAdmins = (participants) => {
                let admins = [];
                for (let i of participants) {
                    i.admin ? admins.push(i.id) : '';
                }
                return admins;
            };

            const admins = isGroup ? getAdmins(participants) : [];
            const isAdmins = isGroup ? admins.includes(userId) : false;

            // --- RESOLVER OBJETIVO (TARGET) ---
            const getTarget = () => {
                let ment = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                let quot = m.message?.extendedTextMessage?.contextInfo?.participant;
                return decodeJid(ment || quot || null);
            };
            const targetId = getTarget();

            // --- CARGA DE PERFIL DESDE MONGODB ---
            let user;
            try {
                user = await User.findOne({ userId }).maxTimeMS(5000); // Timeout de 5 seg para no congelar
                if (!user) {
                    user = new User({ userId });
                    await user.save();
                }
            } catch (mongoErr) {
                console.error("⚠️ Error al cargar usuario de Mongo (Revisa IP Whitelist):", mongoErr.message);
                // Si Mongo falla, enviamos un aviso y no seguimos para evitar crasheos
                return sock.sendMessage(jid, { text: "❌ Error: No se pudo conectar a la base de datos. Verifica el acceso IP en MongoDB Atlas." }, { quoted: m });
            }

            // Actualizar stamina
            if (user.harem) user.harem.forEach(p => actualizarStamina(p));

            // --- HELPER DE RESPUESTA RÁPIDA ---
            const reply = (texto) => sock.sendMessage(jid, { text: texto }, { quoted: m });
			
// ==========================================
// --------- COMANDOS BÁSICOS ---------
// ==========================================

    switch (comando) {
        case 'hola':
		case 'saludo': {
        return message.reply('Hola, soy YakBot ☽\nMucho gusto! ^^');
		}
		break;

        //------------------------------------------------MENU / HELP (TOTALMENTE COMPLETO)--------------------------------------------------------
        case 'menu':
        case 'help':
        case 'ayuda': {
            let menuText = `◢◤ *YAK-BOT SYSTEM* ◢◤\n`;
            menuText += `   _Estado: Online_ 🔋\n\n`;

            menuText += `*〔 ⚔️ GACHA & AVENTURA 〕*\n`;
            menuText += `✧ *${prefix}rw* *${prefix}roll* *${prefix}tirar* *${prefix}rpj*\n`;
            menuText += `> Tira un personaje aleatorio (15m CD).\n\n`;

            menuText += `✧ *${prefix}c* *${prefix}claim* *${prefix}reclamar*\n`;
            menuText += `> Reclama el personaje aparecido.\n\n`;

            menuText += `✧ *${prefix}smob* *${prefix}mob* *${prefix}buscarmob*\n`;
            menuText += `> Busca monstruos en la zona actual.\n\n`;

            menuText += `✧ *${prefix}fight* *${prefix}fmob* *${prefix}atacar* *${prefix}farmear*\n`;
            menuText += `> Pelea contra los mobs (ej: ${prefix}fight p1, p2).\n\n`;

            menuText += `✧ *${prefix}charinfo* *${prefix}infopj* *${prefix}pjstats*\n`;
            menuText += `> Stats, nivel y experiencia del personaje.\n\n`;

            menuText += `✧ *${prefix}harem* *${prefix}coleccion*\n`;
            menuText += `> Mira tu lista de personajes capturados.\n\n`;

            menuText += `✧ *${prefix}wimage* *${prefix}pjimg* *${prefix}verchar*\n`;
            menuText += `> Muestra la imagen de un personaje.\n\n`;

            menuText += `✧ *${prefix}ctired* *${prefix}cansados* *${prefix}cstamina*\n`;
            menuText += `> Energía y cansancio de tu harem.\n\n`;

            menuText += `✧ *${prefix}charlist* *${prefix}enciclopedia*\n`;
            menuText += `> Lista de personajes por serie.\n\n`;

            menuText += `*〔 💰 ECONOMÍA & TIENDA 〕*\n`;
            menuText += `✧ *${prefix}w* *${prefix}chambear* *${prefix}trabajar* *${prefix}work*\n`;
            menuText += `> Gana dinero legalmente.\n\n`;

            menuText += `✧ *${prefix}crime* *${prefix}crimen*\n`;
            menuText += `> Intenta un robo arriesgado.\n\n`;

            menuText += `✧ *${prefix}bal* *${prefix}dinero* *${prefix}cartera* *${prefix}coins*\n`;
            menuText += `> Consulta tu saldo actual.\n\n`;

            menuText += `✧ *${prefix}m* *${prefix}mercado* *${prefix}charshop*\n`;
            menuText += `> Mercado rotativo de personajes nuevos.\n\n`;

            menuText += `✧ *${prefix}bchar* *${prefix}buychar* *${prefix}buycharacter*\n`;
            menuText += `> Compra un personaje del mercado.\n\n`;

            menuText += `✧ *${prefix}shop* *${prefix}tienda* *${prefix}itemshop*\n`;
            menuText += `> Tienda de items (Pociones, XP, Evolución).\n\n`;

            menuText += `✧ *${prefix}buy* *${prefix}comprar*\n`;
            menuText += `> Compra y usa un objeto en un personaje.\n\n`;

            menuText += `✧ *${prefix}daily*\n`;
            menuText += `> Recompensa diaria (Reset 9 PM).\n\n`;

            menuText += `✧ *${prefix}baltop* *${prefix}topricos*\n`;
            menuText += `> Ranking de los más millonarios.\n\n`;

            menuText += `*〔 🫂 SOCIAL & JUEGOS 〕*\n`;
            menuText += `✧ *${prefix}trade* *${prefix}intercambio* *${prefix}trueque*\n`;
            menuText += `> Intercambio de personajes.\n\n`;

            menuText += `✧ *${prefix}aceptartrade* *${prefix}confirmartrade*\n`;
            menuText += `> Acepta el intercambio pendiente.\n\n`;

            menuText += `✧ *${prefix}givechar* *${prefix}regalar* *${prefix}darpersonaje*\n`;
            menuText += `> Obsequia un personaje de tu harem.\n\n`;

            menuText += `✧ *${prefix}duel* *${prefix}retar* *${prefix}duelo*\n`;
            menuText += `> Reta a un usuario a un duelo 3v3.\n\n`;

            menuText += `✧ *${prefix}accept* *${prefix}acceptduel*\n`;
            menuText += `> Acepta el reto de duelo.\n\n`;

            menuText += `✧ *${prefix}pick* [c1, c2, c3]\n`;
            menuText += `> Elige tu equipo para el duelo.\n\n`;

            menuText += `✧ *${prefix}pay* *${prefix}pagar* *${prefix}transferencia*\n`;
            menuText += `> Envía dinero a otro usuario.\n\n`;

            menuText += `✧ *${prefix}dice* *${prefix}dado* *${prefix}apostar*\n`;
            menuText += `> Apuesta dinero al azar.\n\n`;

            menuText += `✧ *${prefix}ship* *${prefix}pareja* *${prefix}shippear*\n`;
            menuText += `> Calcula compatibilidad amorosa.\n\n`;

            menuText += `✧ *${prefix}gay* *${prefix}homo*\n`;
            menuText += `> Calcula el nivel de "gayness".\n\n`;

            menuText += `✧ *Reacciones* (Anime)\n`;
            menuText += `> ${prefix}cry, ${prefix}happy, ${prefix}punch, ${prefix}kill, ${prefix}pat,\n`;
            menuText += `> ${prefix}preg, ${prefix}laugh, ${prefix}dance, ${prefix}sleep, ${prefix}hug...\n\n`;

            menuText += `*〔 ⚙️ UTILIDAD & SISTEMA 〕*\n`;
            menuText += `✧ *${prefix}profile* *${prefix}perfil*\n`;
            menuText += `> Mira tu perfil global.\n\n`;

            menuText += `✧ *${prefix}logros* *${prefix}platino*\n`;
            menuText += `> Tus medallas y objetivos completados.\n\n`;

            menuText += `✧ *${prefix}cooldowns* *${prefix}esperas*\n`;
            menuText += `> Revisa tus tiempos de espera restantes.\n\n`;

            menuText += `✧ *${prefix}s* *${prefix}sticker*\n`;
            menuText += `> Imagen/Video ⇢ Sticker.\n\n`;

            menuText += `✧ *${prefix}cal* *${prefix}calculadora*\n`;
            menuText += `> Realiza operaciones matemáticas.\n\n`;

            menuText += `✧ *${prefix}tr* *${prefix}say* *${prefix}ping* *${prefix}info*\n`;
            menuText += `> Traductor, repetir, estado y creador.\n\n`;

            menuText += `✧ *${prefix}kick* *${prefix}sacar* *${prefix}expulsar*\n`;
            menuText += `> (Admin) Remueve a un usuario del grupo.\n\n`;

            menuText += `━━━━━━━━━━━━━━━━━━━━\n`;
            menuText += `⌬ _Prefijo: [ ${prefix} ]_ | *YakBot v2.5*\n`;
            menuText += `_Usa ${prefix}ayuda [comando] para más info._`;

            return reply(menuText);
		}

        //------------------------------------------------CALCULATOR--------------------------------------------------------
        case 'cal':
        case 'calculadora': {
            // Cambio: Usamos 'content' en lugar de 'message.body'
            const operacionRaw = content.slice(prefix.length + comando.length).trim();
            
            if (!operacionRaw) {
                return reply(`『 🧮 *CALCULADORA* 』\n\nUso: *${prefix}cal [operación]*\n\n*Soportados:* \n√ , π , ÷ , × , ± , %\nExponentes: ² , ³ , ⁴ ... ⁿ\nFracciones: ½ , ¼ , ¾\n\n_Ejemplo: ${prefix}cal √64 + ½_`);
            }

            try {
                let operacion = operacionRaw.toLowerCase();
                const mapaGboard = {
                    '×': '*', '÷': '/', '±': '+', 'π': 'Math.PI', '√': 'Math.sqrt', ',': '.', ':': '/',
                    '⁰': '**0', '¹': '**1', '²': '**2', '³': '**3', '⁴': '**4', '⁵': '**5', 
                    '⁶': '**6', '⁷': '**7', '⁸': '**8', '⁹': '**9', 'ⁿ': '**n',
                    '½': '0.5', '⅓': '(1/3)', '⅔': '(2/3)', '¼': '0.25', '¾': '0.75', 
                    '⅕': '0.2', '⅖': '0.4', '⅗': '0.6', '⅘': '0.8', '⅙': '(1/6)', 
                    '⅚': '(5/6)', '⅛': '0.125', '⅜': '0.375', '⅝': '0.625', '⅞': '0.875'
                };

                Object.keys(mapaGboard).forEach(simbolo => {
                    operacion = operacion.split(simbolo).join(mapaGboard[simbolo]);
                });

                operacion = operacion.replace(/x/g, '*').replace(/\^/g, '**').replace(/%/g, '/100');

                if (operacion.includes('Math.sqrt')) {
                    operacion = operacion.replace(/Math\.sqrt\s*(\d+(\.\d+)?)/g, 'Math.sqrt($1)');
                }

                // Seguridad: Solo permitimos caracteres matemáticos básicos
                const validacion = operacion.replace(/[0-9+\-*/().\s]|Math\.(sqrt|PI)/g, '');
                if (validacion.trim().length > 0) {
                    return reply("❌ *Error:* Caracteres no permitidos detectados.");
                }

                const resultado = eval(operacion);
                const resultadoFinal = Number.isInteger(resultado) 
                    ? resultado.toLocaleString() 
                    : parseFloat(resultado.toFixed(4)).toLocaleString();

                // Cambio: 'message.reply' -> 'reply'
                return reply(`『 🧮 *RESULTADO* 』\n\n✨ *Entrada:* ${operacionRaw}\n✅ *Cálculo:* ${resultadoFinal}`);
            } catch (e) {
                return reply("❌ *Error:* Operación inválida.");
            }
        }
        break;

        //------------------------------------------------GAY--------------------------------------------------------
        case 'gay':
        case 'homo': {
            // targetId ya está limpio en el Bloque 10
            if (!targetId) return reply(`Uso: ${prefix}gay @usuario o responde a su mensaje.`);

            const usuarioMencionado = `@${targetId.split('@')[0]}`;
            
            // Usamos reply para el mensaje inicial
            reply("ꕤ Calculando nivel de gay...");

            // El setTimeout se mantiene igual, pero el envío cambia
            setTimeout(async () => {
                let porcentaje = Math.random() < 0.15 
                    ? Math.floor(Math.random() * 1000000000) 
                    : Math.floor(Math.random() * 100) + 1;

                // En Baileys usamos sock.sendMessage
                await sock.sendMessage(jid, { 
                    text: `🏳️‍🌈 Resultado:\n${usuarioMencionado} es *${porcentaje}%* gay`, 
                    mentions: [targetId] 
                }, { quoted: m });

            }, 2500);
        }
        break;

                //------------------------------------------------PROFILE--------------------------------------------------------
        case 'profile':
        case 'perfil': {
            const idParaVer = targetId || userId;
            let p = await User.findOne({ userId: idParaVer });
            if (!p) {
                p = new User({ userId: idParaVer });
                await p.save();
            }

            // En Baileys el nombre del autor ya lo tenemos en 'authorName'. 
            // Si es otra persona, intentamos sacar su nombre del mensaje o usamos su número.
            const nombre = idParaVer === userId ? authorName : (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ? 'Usuario' : idParaVer.split('@')[0]);
            
            const xpNecesaria = p.level * 100;
            let texto = `👤 *PERFIL DE ${nombre.toUpperCase()}*\n\n`;
            texto += `⭐ *Nivel:* ${p.level}\n`;
            texto += `✨ *XP:* ${p.xp} / ${xpNecesaria}\n`;
            texto += `💬 *Mensajes:* ${p.mensajes}\n`;
            texto += `💰 *Dinero:* $${p.dinero.toLocaleString()}\n`;
            texto += `🏆 *Logros:* ${p.logros.length}\n`;

            try {
                // Intentamos obtener la URL de la foto de perfil con el socket de Baileys
                const fotoUrl = await sock.profilePictureUrl(idParaVer, 'image').catch(() => null);

                if (fotoUrl) {
                    // En Baileys enviamos la imagen directamente por URL
                    await sock.sendMessage(jid, { 
                        image: { url: fotoUrl }, 
                        caption: texto,
                        mentions: [idParaVer]
                    }, { quoted: m });
                } else {
                    await reply(texto);
                }
            } catch (err) {
                await reply(texto);
            }
        }
        break;

                //------------------------------------------------LOGROS--------------------------------------------------------
        case 'logros':
        case 'platino': {
            const idParaVer = targetId || userId;
            let p = await User.findOne({ userId: idParaVer });

            // Verificamos si existe el usuario o si tiene logros
            if (!p || !p.logros || p.logros.length === 0) {
                return reply(targetId ? "❌ Este usuario no tiene logros." : "❌ No tienes logros todavía.");
            }

            let texto = "🏆 *TUS LOGROS*\n\n";
            p.logros.forEach(l => {
                // Usamos tu objeto logrosInfo que ya tienes definido en otra parte del código
                texto += `• ${logrosInfo[l] || l}\n`;
            });

            // Cambiamos message.reply por nuestra función reply
            return reply(texto);
        }
        break;
			
                //------------------------------------------------PING (ESTADO)--------------------------------------------------------
        case 'ping': {
            // En Baileys usamos m.messageTimestamp. Si no existe, usamos Date.now() como respaldo.
            const timestamp = m.messageTimestamp || Math.floor(Date.now() / 1000);
            const latencia = Date.now() - (timestamp * 1000);
            const memoria = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2); 
            
            // Cambiamos message.reply por nuestra función reply
            return reply(`¡Pong!\n\n> *Latencia:* ${latencia}ms\n> *RAM:* ${memoria} MB\n> *Estado:* Online`);
        }
        break;

                //------------------------------------------------CHARLIST--------------------------------------------------------
        case 'charlist':
        case 'enciclopedia': {
            const filtroFuente = args.join(" ").trim();

            // Si NO escribe fuente → mostrar resumen de series disponibles
            if (!filtroFuente) {
                const fuentes = {};

                // Mantenemos tu lógica de conteo por serie
                personajes.forEach(p => {
                    if (!fuentes[p.fuente]) {
                        fuentes[p.fuente] = 0;
                    }
                    fuentes[p.fuente]++;
                });

                let respuesta = `『 📜 *LISTA DE FUENTES* 』\n\n`;
                respuesta += `Total de personajes: ${personajes.length}\n\n`;

                Object.keys(fuentes).sort().forEach(f => {
                    respuesta += `🔹 ${f} (${fuentes[f]})\n`;
                });

                respuesta += `\n_Usa *${prefix}charlist [Fuente]* para ver los nombres._`;

                // Cambio: message.reply -> reply
                return reply(respuesta);
            }

            // Si SÍ escribe fuente → filtrar personajes
            const filtrados = personajes.filter(p =>
                p.fuente.toLowerCase() === filtroFuente.toLowerCase()
            );

            if (filtrados.length === 0) {
                return reply("❌ No se encontró esa fuente en la base de datos.");
            }

            let respuesta = `『 📜 *${filtroFuente.toUpperCase()}* 』\n\n`;
            respuesta += `Total: ${filtrados.length} personajes\n\n`;

            // Listado simple de nombres
            filtrados.forEach(p => {
                respuesta += `• ${p.nombre}\n`;
            });

            // Cambio: message.reply -> reply
            return reply(respuesta);
        }
        break;
			
        //------------------------------------------------PAY (TRANSFERENCIA)--------------------------------------------------------
        case 'pay':
        case 'transferencia':
        case 'pagar': {
            try {
                // En Baileys m.isGroup es un booleano que ya extrajimos
                if (!m.isGroup) {
                    return reply("❌ Este comando solo funciona en grupos.");
                }

                // Usamos 'args' que ya tenemos definido del Bloque 10
                if (args.length < 2) {
                    return reply(`💡 Uso: *${prefix}pay [cantidad] @usuario*`);
                }

                const cantidad = parseInt(args[0]);
                if (isNaN(cantidad) || cantidad <= 0) {
                    return reply("❌ Cantidad inválida.");
                }

                // targetId ya viene resuelto (mención o quote) del Bloque 10
                if (!targetId) {
                    return reply("❌ Debes mencionar a alguien o responder a su mensaje.");
                }

                if (targetId === userId) {
                    return reply("😂 No puedes pagarte a ti mismo, genio.");
                }

                let receptor = await User.findOne({ userId: targetId });
                if (!receptor) {
                    receptor = new User({ userId: targetId });
                    await receptor.save();
                }

                // 'user' es el documento del emisor que cargamos al inicio del switch
                if (user.dinero < cantidad) {
                    return reply("💸 No tienes suficiente dinero para esta transferencia.");
                }

                // Proceso de transferencia
                user.dinero -= cantidad;
                receptor.dinero += cantidad;

                await user.save();
                await receptor.save();

                const numero = targetId.split("@")[0];
                const textoFinal = `『 💸 *TRANSFERENCIA EXITOSA* 』\n\n` +
                                 `✅ Enviaste *$${cantidad.toLocaleString()}* a @${numero}\n` +
                                 `💰 Tu balance actual: *$${user.dinero.toLocaleString()}*`;

                // Para que el @numero brille en azul, usamos sock.sendMessage con mentions
                return sock.sendMessage(jid, { 
                    text: textoFinal, 
                    mentions: [targetId] 
                }, { quoted: m });

            } catch (err) {
                console.error("ERROR EN PAY:", err);
                return reply("❌ Ocurrió un error al procesar el pago.");
            }
        }
        break;

                //------------------------------------------------COOLDOWNS--------------------------------------------------------
        case 'cooldowns':
        case 'esperas': {
            const ahora = Date.now();
            
            // Usamos user (que cargamos en el Bloque 10) y grupoId (que es jid en Baileys)
            const cd = user.cooldowns?.[jid] || {};

            const tiempoRW = 15 * 60 * 1000;    // 15 min
            const tiempoC = 20 * 60 * 1000;     // 20 min
            const tiempoW = 1 * 60 * 1000;      // 1 min
            const tiempoCrime = 5 * 60 * 1000;  // 5 min

            const rRestante = Math.max(0, tiempoRW - (ahora - (cd.lastRW || 0)));
            const cRestante = Math.max(0, tiempoC - (ahora - (cd.lastClaim || 0)));
            const wRestante = Math.max(0, tiempoW - (ahora - (user.lastWork || 0)));
            const crRestante = Math.max(0, tiempoCrime - (ahora - (user.lastCrime || 0)));

            let msg = `『 ⏱️ *TUS TIEMPOS EN ESTE GRUPO* 』\n\n`;
            msg += `🎰 *Roll (?rw):* ${rRestante > 0 ? msToTime(rRestante) : '✅ LISTO'}\n`;
            msg += `📩 *Claim (?c):* ${cRestante > 0 ? msToTime(cRestante) : '✅ LISTO'}\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `💼 *Trabajo:* ${wRestante > 0 ? msToTime(wRestante) : '✅ LISTO'}\n`;
            msg += `🕶️ *Crimen:* ${crRestante > 0 ? msToTime(crRestante) : '✅ LISTO'}\n`;

            // Cambio: message.reply -> reply
            return reply(msg);
        }
        break;
			

	//====================== E C O N O M I A  ==========================
			
//------------------------------------------------W (TRABAJAR)--------------------------------------------------------
        case 'w':
        case 'trabajar':
        case 'chambear':
        case 'work': {
            const ahora = Date.now();
            const cooldown = 60 * 1000; // 1 minuto

            // Verificamos el cooldown dentro del objeto cooldowns
            if (ahora - (user.cooldowns.lastWork || 0) < cooldown) {
                const restante = cooldown - (ahora - (user.cooldowns.lastWork || 0));
                return reply(`◔ Espera *${msToTime(restante)}* para volver a trabajar.`);
            }

            const ganancia = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
            user.dinero += ganancia;
            
            // Guardamos el tiempo en el objeto cooldowns
            user.cooldowns.lastWork = ahora;
            
            if (user.comandos !== undefined) {
                user.comandos += 1;
            }

            // IMPORTANTE: Avisar a Mongoose que el objeto cambió para que lo guarde
            user.markModified('cooldowns');
            await user.save();
            
            return reply(`⌨️ Has trabajado con éxito.\n\n💵 Ganaste: *$${ganancia.toLocaleString()}*\n💰 Balance Total: *$${user.dinero.toLocaleString()}*`);
        }
        break;
			
//------------------------------------------------CRIME (CRIMEN)--------------------------------------------------------
        case 'crime':
        case 'crimen': {
            const ahora = Date.now();
            const cooldown = 5 * 60 * 1000; // 5 minutos

            // Verificamos el cooldown dentro del objeto cooldowns
            if (ahora - (user.cooldowns.lastCrime || 0) < cooldown) {
                const restante = cooldown - (ahora - (user.cooldowns.lastCrime || 0));
                return reply(`◔ Espera *${msToTime(restante)}* para intentar otro crimen.`);
            }

            // Probabilidad del 50%
            const exito = Math.random() < 0.5;
            
            // Guardamos el tiempo en el objeto cooldowns
            user.cooldowns.lastCrime = ahora;
            
            if (user.comandos !== undefined) user.comandos += 1;

            let mensajeFinal = "";

            if (exito) {
                const ganancia = Math.floor(Math.random() * (7000 - 5000 + 1)) + 5000;
                user.dinero += ganancia;
                mensajeFinal = `✪ *¡CRIMEN EXITOSO!* ✪\n\n🕵️‍♂️ Lograste el golpe perfecto.\n💵 Ganaste: *$${ganancia.toLocaleString()}*\n💰 Balance actual: *$${user.dinero.toLocaleString()}*`;
            } else {
                const perdida = Math.floor(Math.random() * (6000 - 4000 + 1)) + 4000;
                user.dinero = Math.max(0, user.dinero - perdida);
                mensajeFinal = `👮‍♂️ *¡TE ATRAPARON!* 👮‍♂️\n\nLa policía te confiscó el equipo.\n📉 Perdiste: *$${perdida.toLocaleString()}*\n💰 Balance actual: *$${user.dinero.toLocaleString()}*`;
            }

            // IMPORTANTE: Avisar a Mongoose que el objeto cambió antes de salvar
            user.markModified('cooldowns');
            await user.save();
            
            return reply(mensajeFinal);
        }
        break;
			
        //------------------------------------------------DAILY (RECOMPENSA)--------------------------------------------------------
        case 'daily': {
            const ahora = new Date();
            const msPorDia = 24 * 60 * 60 * 1000;
            
            // Calculamos el último hito de las 9:00 PM (21:00)
            let ultimoHito9PM = new Date();
            ultimoHito9PM.setHours(21, 0, 0, 0);
            
            if (ahora < ultimoHito9PM) {
                ultimoHito9PM.setTime(ultimoHito9PM.getTime() - msPorDia);
            }

            const lastDailyTime = user.lastDaily || 0;

            // 1. Verificación de Cooldown
            if (lastDailyTime > ultimoHito9PM.getTime()) {
                let proximoReset = new Date(ultimoHito9PM.getTime() + msPorDia);
                const faltante = proximoReset - ahora;
                // Cambio: message.reply -> reply
                return reply(`⏳ Ya reclamaste tu daily.\nRegresa en *${msToTime(faltante)}* (9:00 PM).`);
            }

            // 2. Lógica de Racha (Streak)
            const limiteRacha = ultimoHito9PM.getTime() - msPorDia;
            if (lastDailyTime < limiteRacha) {
                user.rachaDaily = 1;
            } else {
                user.rachaDaily = Math.min(50, (user.rachaDaily || 0) + 1);
            }

            // 3. Cálculo de Premio
            const base = 10000;
            const incremento = Math.floor((user.rachaDaily - 1) * (190000 / 49));
            const premioFinal = base + incremento;

            user.dinero += premioFinal;
            user.lastDaily = ahora.getTime();
            
            // Guardamos cambios en MongoDB
            await user.save();

            let rachaMsg = user.rachaDaily === 50 ? "🔥 ¡RACHA MÁXIMA ALCANZADA! 🔥" : `📈 Racha actual: *Día ${user.rachaDaily}*`;

            // Cambio: message.reply -> reply
            return reply(`『 🎁 *RECOMPENSA DIARIA* 』\n\n${rachaMsg}\n💰 Has recibido: *$${premioFinal.toLocaleString()}*\n\n_Vuelve mañana después de las 9:00 PM_`);
        }
        break;

        //------------------------------------------------BAL (BILLETERA)--------------------------------------------------------
        case 'bal':
        case 'balance':
        case 'cartera':
        case 'billetera':
        case 'dinero': {
            const idVer = targetId || userId;
            let targetUser = await User.findOne({ userId: idVer });
            
            // Si el usuario no existe en la DB, lo creamos para que no de error
            if (!targetUser) {
                targetUser = new User({ userId: idVer });
                await targetUser.save();
            }

            const nombre = idVer === userId ? "TU BILLETERA" : "BILLETERA DEL USUARIO";
            
            // Si es la billetera de otro, mencionamos al usuario para que sepa de quién es
            const mencion = idVer === userId ? "" : `\n👤 *Usuario:* @${idVer.split('@')[0]}`;

            const textoBal = `💰 *${nombre}*\n━━━━━━━━━━━━━━${mencion}\n» Balance actual: *$${targetUser.dinero.toLocaleString()}*`;

            // Usamos sock.sendMessage para que la mención funcione si idVer es otro usuario
            return sock.sendMessage(jid, { 
                text: textoBal, 
                mentions: [idVer] 
            }, { quoted: m });
        }
        break;
			

// ==========================================
//           SISTEMA DE TIENDA (SHOP)
// ==========================================

        //------------------------------------------------SHOP (TIENDA DE OBJETOS)--------------------------------------------------------
        case 'shop':
        case 'tienda':
        case 'itemshop': {
            let tabla = `🛒 *TIENDA DE LUJO YAKBOT*\n`;
            tabla += `━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            tabla += `1️⃣ *Poción de Energía* (⚡+50)\n`;
            tabla += `    ╰┈─ ➤ Precio: $15,000\n`;
            tabla += `    ╰┈─ ➤ Uso: ${prefix}buy 1 [Nombre del PJ]\n\n`;
            
            tabla += `2️⃣ *Amuleto Maestro* (✨+100 XP)\n`;
            tabla += `    ╰┈─ ➤ Precio: $35,000\n`;
            tabla += `    ╰┈─ ➤ Uso: ${prefix}buy 2 [Nombre del PJ]\n\n`;
            
            tabla += `3️⃣ *Piedra de Evolución* (⭐ +1 Nivel)\n`;
            tabla += `    ╰┈─ ➤ Precio: $80,000\n`;
            tabla += `    ╰┈─ ➤ Uso: ${prefix}buy 3 [Nombre del PJ]\n\n`;
            
            tabla += `4️⃣ *Bendición del Admin* (💖 +2 Niveles y Full Stamina)\n`;
            tabla += `    ╰┈─ ➤ Precio: $150,000\n`;
            tabla += `    ╰┈─ ➤ Uso: ${prefix}buy 4 [Nombre del PJ]\n\n`;
            
            tabla += `5️⃣ *Contrato Eterno* (📜 +50% Valor Base)\n`;
            tabla += `    ╰┈─ ➤ Precio: $300,000\n`;
            tabla += `    ╰┈─ ➤ Uso: ${prefix}buy 5 [Nombre del PJ]\n\n`;
            
            tabla += `━━━━━━━━━━━━━━━━━━━━\n`;
            // user ya viene definido desde el inicio del switch
            tabla += `⌬ Tu Balance: *$${user.dinero.toLocaleString()}*`;
            
            // Cambio: message.reply -> reply
            return reply(tabla);
        }
        break;

        //------------------------------------------------BUY (COMPRAR OBJETOS)--------------------------------------------------------
        case 'buy':
        case 'comprar': {
            const itemNum = args[0];
            const targetName = args.slice(1).join(' ').toLowerCase().trim();

            if (!itemNum || !targetName) return reply(`❌ Uso: *${prefix}buy [número] [nombre del personaje]*`);

            // Buscamos al personaje en el harem del usuario (user ya viene de MongoDB)
            const personaje = user.harem.find(p => p.nombre.toLowerCase() === targetName);
            if (!personaje) return reply(`❌ No tienes a **${targetName}** en tu harem.`);

            const precios = { "1": 15000, "2": 35000, "3": 80000, "4": 150000, "5": 300000 };
            const costo = precios[itemNum];

            if (!costo) return reply("❌ Número de objeto inválido.");
            if (user.dinero < costo) return reply(`💸 No tienes suficiente dinero. Necesitas *$${costo.toLocaleString()}*.`);

            // Procesar el efecto del item
            user.dinero -= costo;

            if (itemNum === '1') {
                personaje.stamina = Math.min(100, (personaje.stamina || 0) + 50);
                reply(`🧪 *Poción* usada en ${personaje.nombre}. Stamina: ${personaje.stamina}%`);
            } 
            else if (itemNum === '2') {
                personaje.exp = (personaje.exp || 0) + 100;
                while (personaje.exp >= (personaje.level || 1) * 100) {
                    personaje.exp -= (personaje.level || 1) * 100;
                    personaje.level = (personaje.level || 1) + 1;
                }
                reply(`✨ *Amuleto* usado. ${personaje.nombre} subió al nivel ${personaje.level}.`);
            } 
            else if (itemNum === '3') {
                personaje.level = (personaje.level || 1) + 1;
                reply(`⭐ ¡${personaje.nombre} subió al nivel ${personaje.level} con la Piedra!`);
            } 
            else if (itemNum === '4') {
                personaje.stamina = 100;
                personaje.level = (personaje.level || 1) + 2;
                reply(`💖 ¡${personaje.nombre} bendecido!\n🆙 +2 Niveles (Nivel: ${personaje.level})\n⚡ Energía al 100%`);
            } 
            else if (itemNum === '5') {
                personaje.valor = Math.floor((personaje.valor || 0) * 1.5);
                reply(`📜 *Contrato Eterno* firmado.\n📈 Valor de ${personaje.nombre} subió a *$${personaje.valor.toLocaleString()}*.`);
            }

            // --- LÓGICA DE EVOLUCIÓN AUTOMÁTICA ---
            const dataOriginal = personajes.find(p => p.nombre.toLowerCase() === personaje.nombre.toLowerCase());
            
            if (dataOriginal && dataOriginal.evolucion && personaje.level >= dataOriginal.nivelEvo) {
                const datosEvo = personajes.find(pe => pe.nombre.toLowerCase() === dataOriginal.evolucion.toLowerCase());
                if (datosEvo) {
                    const nombreViejo = personaje.nombre;
                    personaje.nombre = datosEvo.nombre;
                    personaje.imagen = datosEvo.imagen;
                    personaje.valor = datosEvo.valor;
                    reply(`✨ ¡INCREÍBLE! *${nombreViejo}* ha evolucionado a... ¡*${personaje.nombre}*! 🎉`);
                }
            }

            // IMPORTANTE: Avisar a Mongoose que el array 'harem' cambió
            user.markModified('harem');
            await user.save();
        }
        break;

         //------------------------------------------------CHARSHOP (MERCADO ROTATIVO)--------------------------------------------------------
        case 'charshop':
        case 'mercado':
        case 'm': {
            // En Baileys usamos 'jid' que es el ID del chat actual
            const shopDelGrupo = await actualizarCharShop(jid); 
            
            const ahora = Date.now();
            // 3,000,000 ms son 50 minutos exactos
            const tiempoRestante = 3000000 - (ahora - shopDelGrupo.ultimaActualizacion);
            
            let msg = `『 🏪 *MERCADO DE PERSONAJES* 』\n`;
            msg += `⏱️ Rotación en: ${msToTime(tiempoRestante)}\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

            if (!shopDelGrupo.personajes || shopDelGrupo.personajes.length === 0) {
                msg += "⚠️ No hay personajes disponibles en este momento.";
            } else {
                shopDelGrupo.personajes.forEach((p, i) => {
                    msg += `*${i + 1}* ⇢ *${p.nombre}*\n`;
                    msg += `╰┈─ ➤ *Costo:* $${p.precio.toLocaleString()} | *Fuente:* ${p.fuente}\n\n`;
                });
                msg += `_Usa *?bchar [número]* para comprar._\n`;
            }

            msg += `━━━━━━━━━━━━━━━━━━━━\n`;
            // 'user' ya está cargado desde el inicio del switch
            msg += `⌬ Tu Saldo: *$${user.dinero.toLocaleString()}*`;
            
            // Cambio: message.reply -> reply
            return reply(msg);
        }
        break;
			
        //------------------------------------------------BCHAR (COMPRAR PERSONAJE)--------------------------------------------------------
        case 'bchar':
        case 'buychar':
        case 'buycharacter': {
            // En Baileys usamos 'jid' para identificar el chat/grupo
            const shopDelGrupo = await actualizarCharShop(jid);
            const num = parseInt(args[0]);
            const indice = num - 1;

            if (isNaN(num) || !shopDelGrupo.personajes[indice]) {
                return reply("❌ Número inválido. Mira el mercado con *?m*.");
            }

            const item = shopDelGrupo.personajes[indice];

            if (user.dinero < item.precio) {
                return reply(`❌ Dinero insuficiente. Te faltan *$${(item.precio - user.dinero).toLocaleString()}*.`);
            }

            // Transacción
            user.dinero -= item.precio;
            
            // Añadir al harem con los campos necesarios para tu sistema de RPG
            user.harem.push({
                nombre: item.nombre,
                fuente: item.fuente,
                valor: item.valor,
                imagen: item.imagen,
                level: 1,
                exp: 0,
                stamina: 100,
                grupoId: jid,
                lastUpdate: Date.now(),
                evolucion: item.evolucion || null,
                nivelEvo: item.nivelEvo || null
            });

            // Quitar de la tienda para que nadie más lo compre en esta rotación
            shopDelGrupo.personajes.splice(indice, 1);
            
            // Marcamos el array harem como modificado para que Mongoose guarde los cambios internos
            user.markModified('harem');
            
            // Guardamos ambos documentos en MongoDB
            await user.save();
            await shopDelGrupo.save();

            return reply(`🎉 ¡COMPRA EXITOSA!\n\nHas adquirido a: *${item.nombre}*\n💰 Saldo restante: *$${user.dinero.toLocaleString()}*`);
        }
        break;


        //------------------------------------------------BALTOP (RANKING DE RIQUEZA)--------------------------------------------------------
        case 'baltop':
        case 'topricos': {
            try {
                // Buscamos los 10 usuarios con más dinero en MongoDB
                const topUsuarios = await User.find({})
                    .sort({ dinero: -1 }) 
                    .limit(10);           

                if (!topUsuarios || topUsuarios.length === 0) {
                    return reply("❌ No hay registros de economía todavía.");
                }

                let textoTop = "『 🏆 *RANKING DE RIQUEZA* 』\n";
                textoTop += "━━━━━━━━━━━━━━━━━━━━\n\n";
                
                let mentions = [];

                topUsuarios.forEach((u, index) => {
                    const idLimpia = u.userId;
                    const numero = idLimpia.split('@')[0];
                    
                    let medalla = "👤";
                    if (index === 0) medalla = "🥇";
                    else if (index === 1) medalla = "🥈";
                    else if (index === 2) medalla = "🥉";

                    textoTop += `${medalla} *${index + 1}* ⇢ @${numero}\n`;
                    textoTop += `╰┈─ ➤ *$${u.dinero.toLocaleString()}*\n\n`;
                    
                    mentions.push(idLimpia);
                });

                textoTop += "━━━━━━━━━━━━━━━━━━━━\n";
                textoTop += `_¡Sigue trabajando para subir en el top!_`;

                // En Baileys usamos sock.sendMessage enviando un objeto con 'text' y 'mentions'
                return sock.sendMessage(jid, { 
                    text: textoTop, 
                    mentions 
                }, { quoted: m });

            } catch (err) {
                console.error("ERROR EN BALTOP:", err);
                return reply("⚠️ No se pudo cargar el ranking en este momento.");
            }
        }
        break;
			
        //------------------------------------------------DUEL (INICIAR RETO)--------------------------------------------------------
        case 'duel':
        case 'retar':
        case 'duelo': {
            if (!m.isGroup) return reply("❌ Solo funciona en grupos.");
            
            // Usamos jid que es el ID del grupo en Baileys
            if (duelosActivos[jid]) return reply("⚠️ Ya hay un duelo pendiente en este grupo.");
            
            if (!targetId) return reply("❌ Debes mencionar a alguien para retarlo.");
            if (targetId === userId) return reply("🤡 No puedes pelear contra tu sombra.");

            const timeoutAceptacion = setTimeout(async () => {
                if (duelosActivos[jid]) {
                    delete duelosActivos[jid];
                    await sock.sendMessage(jid, { text: "◔ El duelo expiró por falta de respuesta." });
                }
            }, 5 * 60 * 1000); // 5 minutos

            duelosActivos[jid] = {
                jugador1: userId,
                jugador2: targetId,
                picks: {},
                aceptado: false,
                timeoutAceptacion
            };

            const num = targetId.split("@")[0];
            const textoDuelo = `⚔️ *¡RETADOR APARECE!*\n\n@${num}, escribe *${prefix}accept* para aceptar el duelo.\n⌛ Tienes 5 minutos.`;

            // Usamos sock.sendMessage para que la mención sea efectiva
            return sock.sendMessage(jid, { 
                text: textoDuelo, 
                mentions: [targetId] 
            }, { quoted: m });
        }
        break;

        //------------------------------------------------ACCEPT (ACEPTAR RETO)--------------------------------------------------------
        case 'accept':
        case 'acceptduel': {
            // Usamos jid (definido en el Bloque 10) para buscar el duelo en este grupo
            const duelo = duelosActivos[jid];
            
            if (!duelo) return reply("❌ No hay ningún duelo pendiente aquí.");
            if (userId !== duelo.jugador2) return reply("No eres el jugador retado.");

            // Detenemos el timeout de expiración de la invitación
            clearTimeout(duelo.timeoutAceptacion);
            duelo.aceptado = true;

            // Iniciamos un nuevo cronómetro para la fase de selección (Picks)
            duelo.timeoutPick = setTimeout(async () => {
                if (duelosActivos[jid]) {
                    delete duelosActivos[jid];
                    await sock.sendMessage(jid, { text: "⏱️ El duelo ha sido cancelado: se agotó el tiempo para elegir personajes." });
                }
            }, 5 * 60 * 1000); // 5 minutos para elegir

            return reply(`⇎ *DUELO ACEPTADO*\n\nAmbos preparen a sus equipos (1 a 3 personajes).\n\n💡 Uso: *${prefix}pick nombre1, nombre2, nombre3*\n⌛ Tienen 5 minutos para elegir.`);
        }
        break;
			

                //------------------------------------------------PICK (ELECCIÓN Y COMBATE)--------------------------------------------------------
        case 'pick': {
            const duelo = duelosActivos[jid];
            if (!duelo || !duelo.aceptado) return;
            if (userId !== duelo.jugador1 && userId !== duelo.jugador2) return;

            const nombres = args.join(" ").split(",").map(n => n.trim().toLowerCase());
            if (nombres.length < 1 || nombres.length > 3) {
                return reply("❌ Elige de 1 a 3 personajes separados por comas.");
            }

            let equipo = [];
            let valorTotal = 0;
            let tieneADeadpool = false;

            for (let nombre of nombres) {
                const p = user.harem.find(char => char.nombre.toLowerCase() === nombre);
                if (!p) return reply(`❌ No tienes a '${nombre}' en tu harem.`);
                if (equipo.find(e => e.nombre === p.nombre)) return reply(`❌ No puedes repetir a ${p.nombre}.`);

                if (p.nombre === 'Deadpool') {
                    tieneADeadpool = true;
                    p.stamina = 100; 
                } else {
                    if ((p.stamina || 0) <= 10) return reply(`😫 *${p.nombre}* está exhausto (${p.stamina}%).`);
                    p.stamina = Math.max(0, (p.stamina || 0) - 30);
                }

                let poderBase = Number(p.valor) * Math.pow(1.20, ((p.level || 1) - 1));

                if (p.nombre === 'Deadpool' && Math.random() < 0.20) {
                    poderBase *= 5;
                    reply("🔴 *DEADPOOL:* ¡Hackeando las stats del bot! 💥");
                }

                valorTotal += poderBase;
                equipo.push(p);
            }

            // Guardamos el equipo y el poder en el objeto del duelo
            duelo.picks[userId] = { equipo, valorTotal, userObj: user };
            reply(tieneADeadpool ? "✅ Equipo listo. 🔴 *DP:* ¡Que empiece la pachanga! 🌮" : "✅ Equipo seleccionado.");

            // Si ambos ya eligieron, comienza la masacre
            if (duelo.picks[duelo.jugador1] && duelo.picks[duelo.jugador2]) {
                clearTimeout(duelo.timeoutPick);
                
                const p1 = duelo.picks[duelo.jugador1];
                const p2 = duelo.picks[duelo.jugador2];

                let final1 = p1.valorTotal * (0.95 + Math.random() * 0.1);
                let final2 = p2.valorTotal * (0.95 + Math.random() * 0.1);

                // Easter egg de Deadpool
                if (p1.equipo.some(e => e.nombre === 'Deadpool') && Math.random() < 0.10) {
                    final1 += final2;
                    reply("🔴 *DEADPOOL:* ¡Victoria por puro guionazo! Soy el mejor.");
                } else if (p2.equipo.some(e => e.nombre === 'Deadpool') && Math.random() < 0.10) {
                    final2 += final1;
                    reply("🔴 *DEADPOOL:* ¡Puse explosivos en sus números! Victoria por conveniencia.");
                }

                const ganadorId = final1 > final2 ? duelo.jugador1 : duelo.jugador2;
                const perdedorId = final1 > final2 ? duelo.jugador2 : duelo.jugador1;
                const winData = duelo.picks[ganadorId];
                const loseData = duelo.picks[perdedorId];

                // Robo del 15% del dinero
                const robo = Math.floor(loseData.userObj.dinero * 0.15);
                loseData.userObj.dinero -= robo;
                winData.userObj.dinero += robo;

                // Reparto de XP y Evolución
                for (const pData of [p1, p2]) {
                    const esGanador = pData.userObj.userId === ganadorId;
                    const xpBase = esGanador ? 60 : 20;

                    for (const p of pData.equipo) {
                        p.exp = (p.exp || 0) + xpBase;
                        while (p.exp >= (p.level || 1) * 100) {
                            p.exp -= (p.level || 1) * 100;
                            p.level = (p.level || 1) + 1;
                            
                            const ref = personajes.find(pj => pj.nombre.toLowerCase() === p.nombre.toLowerCase());
                            if (ref && ref.evolucion && p.level >= ref.nivelEvo) {
                                const evo = personajes.find(pj => pj.nombre.toLowerCase() === ref.evolucion.toLowerCase());
                                if (evo) {
                                    p.nombre = evo.nombre;
                                    p.imagen = evo.imagen;
                                    p.valor = evo.valor;
                                    sock.sendMessage(jid, { text: `✨ ¡*${evo.nombre}* ha evolucionado tras el combate!` });
                                }
                            }
                        }
                    }
                    // Vital para guardar cambios en arreglos y documentos
                    pData.userObj.markModified('harem');
                    await pData.userObj.save();
                }

                let res = `『 ⚔️ *RESULTADO DEL DUELO* 』\n\n`;
                res += `👤 @${duelo.jugador1.split('@')[0]}: ${Math.floor(final1).toLocaleString()}\n`;
                res += `👤 @${duelo.jugador2.split('@')[0]}: ${Math.floor(final2).toLocaleString()}\n\n`;
                res += `🏆 *GANADOR:* @${ganadorId.split('@')[0]}\n💰 Recompensa: *$${robo.toLocaleString()}*`;

                await sock.sendMessage(jid, { 
                    text: res, 
                    mentions: [duelo.jugador1, duelo.jugador2] 
                }, { quoted: m });

                delete duelosActivos[jid];
            }
        }
        break;


        //------------------------------------------------INFO (SISTEMA)--------------------------------------------------------
        case 'info': {
            let msg = `『 ⚙️ *YAKBOT INFO* 』\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
            msg += `🤖 *Versión:* v2.5.3.tengo sueño\n`;
            msg += `⚡ *Engine:* Node.js v18.x\n`;
            msg += `🔥 *Estado:* Estable (la vdd c va a crashear y/o a reiniciar tarde o temprano)\n`;
            msg += `☁️ *Hosting:* Railway (De milagro sigue vivo)\n\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━`;
            
            // Cambio: message.reply -> reply
            return reply(msg);
        }
        break;
			
        //------------------------------------------------CREADOR (ORIGEN)--------------------------------------------------------
        case 'creador': {
            return reply('🧠 Fui creado por una mente esquizofrenica: *Jack*.');
        }
        break;

        //------------------------------------------------NUMERO (AZAR)--------------------------------------------------------
        case 'numero': {
            const num = Math.floor(Math.random() * 100) + 1;
            return reply(`🎲 Tu número random es: *${num}*`);
        }
        break;

      //------------------------------------------------RW (ROLL CHARACTER)--------------------------------------------------------
case 'rw':
case 'roll':
case 'tirar':
case 'rpj': {
    if (procesandoRW.has(jid)) return;
    procesandoRW.add(jid);

    try {
        const ahora = Date.now();
        const totalRW = 15 * 60 * 1000; // 15 minutos

        if (!user.cooldowns) user.cooldowns = {};
        const cooldownGrupo = user.cooldowns[jid] || {};
        const lastRWGrupo = cooldownGrupo.lastRW || 0;

        if (ahora - lastRWGrupo < totalRW) {
            const restante = totalRW - (ahora - lastRWGrupo);
            return reply(`◔ Espera *${msToTime(restante)}* para sacar a otro personaje.`);
        }

        // --- Selección por Pesos ---
        const listaPesos = personajes.map(p => {
            const v = parseInt(p.valor) || 1000;
            let pesoFinal = (v >= 17000) ? 100 / Math.pow(v / 17000, 2.5) : 100;
            return { p, peso: pesoFinal };
        });

        const sumaPesosTotal = listaPesos.reduce((s, i) => s + i.peso, 0);
        let randomNum = Math.random() * sumaPesosTotal;
        let personajeSeleccionado = personajes[Math.floor(Math.random() * personajes.length)];

        for (const item of listaPesos) {
            randomNum -= item.peso;
            if (randomNum <= 0) {
                personajeSeleccionado = item.p;
                break;
            }
        }

        // Verificar dueño en este grupo
        const yaReclamado = await User.findOne({ 
            "harem.nombre": personajeSeleccionado.nombre, 
            "harem.grupoId": jid 
        });
        
        let estado = yaReclamado ? "Ya tiene dueño" : "Libre";

        let avisoRareza = "";
        const vNum = parseInt(personajeSeleccionado.valor);
        if (vNum >= 20000) avisoRareza = "\n🌌 *¡ENTIDAD CÓSMICA DETECTADA!* 🌌";
        else if (vNum >= 17000) avisoRareza = "\n💎 *¡PERSONAJE LEGENDARIO!* 💎";

        const msgTexto = `『 ✪ *¡PERSONAJE AVISTADO!* ✪ 』${avisoRareza}\n\n` +
            `⟡ *Nombre:* ${personajeSeleccionado.nombre}\n` +
            `⚡︎ *Valor:* ${personajeSeleccionado.valor}\n` +
            `⚥ *Género:* ${personajeSeleccionado.genero}\n` +
            `⊹ *Estado:* ${estado}\n` +
            `➣ *Fuente:* ${personajeSeleccionado.fuente}\n\n` +
            `◇ Responde a este mensaje con *${prefix}c* para reclamar.`;

        // Enviamos la imagen
        const sentMsg = await sock.sendMessage(jid, { 
            image: { url: personajeSeleccionado.imagen }, 
            caption: msgTexto 
        }, { quoted: m });

        // Guardar cooldown
        if (!user.cooldowns[jid]) user.cooldowns[jid] = {};
        user.cooldowns[jid].lastRW = ahora;
        user.markModified('cooldowns'); 
        await user.save();

        // GUARDADO EN MEMORIA: Usamos el ID del mensaje enviado como llave
        tiradasTemporales[sentMsg.key.id] = {
            personaje: personajeSeleccionado,
            grupoId: jid,
            reclamado: !!yaReclamado // Si ya tiene dueño, no se puede reclamar
        };

        // Auto-eliminar después de 1 minuto
        setTimeout(() => {
            if (tiradasTemporales[sentMsg.key.id]) {
                delete tiradasTemporales[sentMsg.key.id];
            }
        }, 60000);

    } catch (error) {
        console.error('Error en RW:', error);
        // Aquí no hacemos reply de error si la imagen ya salió bien
    } finally {
        procesandoRW.delete(jid);
    }
}
break;
			
//------------------------------------------------C (CLAIM)--------------------------------------------------------
        case 'c':
        case 'claim':
        case 'reclamar': {
            // En Baileys, verificamos si m.quoted existe (definido en el Bloque 10)
            if (!m.quoted) return reply('⌦ Responde al mensaje del personaje que quieres reclamar.');

            // El ID del mensaje citado en Baileys es m.quoted.id
            const tirada = tiradasTemporales[m.quoted.id];

            if (!tirada || tirada.reclamado || tirada.grupoId !== jid) {
                return reply('⌦ Ese personaje ya no está disponible o no es de este grupo.');
            }

            const ahora = Date.now();
            const lastClaimGrupo = user.cooldowns?.[jid]?.lastClaim || 0;

            if (ahora - lastClaimGrupo < (20 * 60 * 1000)) {
                const restante = (20 * 60 * 1000) - (ahora - lastClaimGrupo);
                return reply(`◔ Espera *${msToTime(restante)}* para volver a reclamar un personaje.`);
            }

            // Verificar si alguien más ya tiene a este personaje en ESTE grupo específico
            const dueñoExistente = await User.findOne({ 
                "harem.nombre": tirada.personaje.nombre, 
                "harem.grupoId": jid 
            });
            
            if (dueñoExistente) return reply('⌦ Este personaje ya fue reclamado por alguien más en este grupo.');

            // Guardar en el harem con los datos de RPG
            user.harem.push({
                ...tirada.personaje,
                level: 1, 
                exp: 0, 
                stamina: 100, 
                grupoId: jid, // Mantenemos la separación por grupos
                lastUpdate: ahora
            });

            // Actualizar cooldown de reclamo
            if (!user.cooldowns[jid]) user.cooldowns[jid] = {};
            user.cooldowns[jid].lastClaim = ahora;
            
            // Marcar como reclamado para que nadie más lo use en memoria
            tirada.reclamado = true;

            // Avisar a Mongoose que los objetos internos cambiaron para que se guarden en MongoDB
            user.markModified('harem');
            user.markModified('cooldowns');
            
            await user.save();
            
            return reply(`꧁¡Reclamaste a *${tirada.personaje.nombre}*!꧂`);
        }
        break;

        //------------------------------------------------HAREM (COLECCIÓN)--------------------------------------------------------
        case 'harem':
        case 'coleccion': {
            const idUsuarioHarem = targetId || userId;
            
            // Si el dueño es el mismo que escribe, usamos 'user' (ya cargado). Si no, buscamos en la DB.
            const dueño = (idUsuarioHarem === userId) ? user : await User.findOne({ userId: idUsuarioHarem });

            // FILTRAR el harem para que SOLO muestre los personajes de ESTE grupo (jid)
            const haremFiltrado = dueño?.harem?.filter(p => p.grupoId === jid) || [];

            if (haremFiltrado.length === 0) {
                const mensajeVacio = idUsuarioHarem === userId ? '❒ Tu harem está vacío en este grupo.' : '❒ Este usuario no tiene personajes aquí.';
                return reply(mensajeVacio);
            }

            // En Baileys, el nombre suele venir en m.pushName si es quien escribe. 
            // Para otros, usamos el número o buscamos en la base de datos si guardaste nombres.
            const nombreTitulo = (idUsuarioHarem === userId ? m.pushName : idUsuarioHarem.split('@')[0]).toUpperCase();

            // Lógica de páginas (si hay mención, el número de página suele ser el segundo argumento)
            let pIndex = (targetId && targetId !== userId) ? 1 : 0;
            let pagina = parseInt(args[pIndex]) || 1;
            const personajesPorPagina = 20;

            // Ordenar por Valor Real (Poder de combate/rareza)
            let listaOrdenada = [...haremFiltrado];
            listaOrdenada.sort((a, b) => {
                const vA = Math.floor((Number(a.valor) || 0) * Math.pow(1.20, (a.level || 1) - 1));
                const vB = Math.floor((Number(b.valor) || 0) * Math.pow(1.20, (b.level || 1) - 1));
                return vB - vA;
            });

            const totalPaginas = Math.ceil(listaOrdenada.length / personajesPorPagina);
            if (pagina < 1) pagina = 1;
            if (pagina > totalPaginas) pagina = totalPaginas;

            const inicio = (pagina - 1) * personajesPorPagina;
            const personajesPagina = listaOrdenada.slice(inicio, inicio + personajesPorPagina);

            let respuesta = `༺ ${nombreTitulo} ༻\n`;
            respuesta += `━━━━━━━━━━━━━━━━━━━━\n`;
            respuesta += `        ᴘᴀ́ɢɪɴᴀ ${pagina} ᴅᴇ ${totalPaginas}\n\n`;

            personajesPagina.forEach((p, index) => {
                const valBase = Number(p.valor) || 0;
                const lvl = p.level || 1;
                const valorReal = Math.floor(valBase * Math.pow(1.20, lvl - 1));
                let numGlobal = (inicio + index + 1).toString().padStart(2, '0');
                
                respuesta += `⌁ ${numGlobal} ⌁ ${p.nombre} (Lvl ${lvl})\n`;
                respuesta += `    ╰┈─ ➤ ${p.fuente} ✦ ${valorReal.toLocaleString()}\n\n`;
            });

            respuesta += `━━━━━━━━━━━━━━━━━━━━\n`;
            respuesta += `⌬ Total: ${listaOrdenada.length}\n`;
            respuesta += `⌬ Usa: ${prefix}harem [número] o ${prefix}harem @user [número]`;

            // Usamos sock.sendMessage para asegurar que si hay mención, el bot responda correctamente
            return sock.sendMessage(jid, { 
                text: respuesta, 
                mentions: [idUsuarioHarem] 
            }, { quoted: m });
        }
        break;
			
			
        //------------------------------------------------WIMAGE (BUSCAR IMAGEN)--------------------------------------------------------
        case 'wimage':
        case 'pjimg':
        case 'verchar': {
            const nombreBusqueda = args.join(" ").toLowerCase().trim();
            if (!nombreBusqueda) return reply(`❌ Uso: *${prefix}wimage [nombre]*`);

            // Buscamos en la lista global de personajes cargada en memoria
            const pj = personajes.find(p => 
                p.nombre.toLowerCase() === nombreBusqueda || 
                p.nombre.toLowerCase().includes(nombreBusqueda)
            );

            if (!pj) return reply(`❌ No encontré a "${nombreBusqueda}" en la base de datos.`);

            try {
                const caption = `『 *PERSONAJE ENCONTRADO* 』\n\n👤 *Nombre:* ${pj.nombre}\n📺 *Fuente:* ${pj.fuente}`;

                // En Baileys enviamos la imagen directamente con el objeto 'image' y la URL
                return await sock.sendMessage(jid, { 
                    image: { url: pj.imagen }, 
                    caption: caption 
                }, { quoted: m });

            } catch (err) {
                console.error("ERROR EN WIMAGE:", err);
                return reply("⚠️ Error al cargar la imagen o el personaje.");
            }
        }
        break;
			
        //------------------------------------------------CHARINFO (DETALLES)--------------------------------------------------------
        case 'charinfo':
        case 'infopj':
        case 'pjstats': {
            // Unimos los argumentos para nombres compuestos
            let nombreBusqueda = args.join(" ").trim().toLowerCase();

            if (!nombreBusqueda) return reply("❌ Escribe el nombre del personaje.");

            // Buscamos dentro del 'harem' del usuario cargado (filtrando por grupo actual)
            const personaje = user.harem.find(p => 
                p.grupoId === jid && 
                p.nombre.toLowerCase() === nombreBusqueda
            );

            if (!personaje) {
                return reply(`❌ No tienes a "${nombreBusqueda}" en este grupo. Revisa tu *${prefix}harem*.`);
            }

            // Llamamos a la función de actualización de energía (debes tenerla definida en tu código)
            if (typeof actualizarStamina === "function") {
                actualizarStamina(personaje);
            }

            // Cálculo de poder real (opcional, por si quieres mostrarlo en el info)
            const lvl = personaje.level || 1;
            const valorReal = Math.floor((Number(personaje.valor) || 0) * Math.pow(1.20, lvl - 1));

            let info = `『 *DETALLES DEL PERSONAJE* 』\n\n`;
            info += `⭐ *Nombre:* ${personaje.nombre}\n`;
            info += `📺 *Fuente:* ${personaje.fuente || 'Desconocida'}\n`;
            info += `📈 *Nivel:* ${lvl}\n`;
                // Barra de XP visual (opcional)
            const xpNecesaria = lvl * 100;
            info += `✨ *XP:* ${personaje.exp || 0} / ${xpNecesaria}\n`;
            info += `🔋 *Stamina:* ${personaje.stamina || 0}%\n`;
            info += `💰 *Valor Poder:* ${valorReal.toLocaleString()}\n`;
            info += `━━━━━━━━━━━━━━━━━━━━\n`;
            info += `💬 _Usa este personaje para duelos o intercambios._`;

            try {
                const urlImagen = personaje.imagen;
                
                if (urlImagen) {
                    // En Baileys enviamos directamente el objeto image con la URL
                    return await sock.sendMessage(jid, { 
                        image: { url: urlImagen }, 
                        caption: info 
                    }, { quoted: m });
                } else {
                    return reply(info);
                }
            } catch (e) {
                console.error("Error al cargar imagen en charinfo:", e);
                // Si falla la imagen, enviamos solo el texto
                return reply(info);
            }
        }
        break;
			
        //------------------------------------------------DICE (APUESTAS)--------------------------------------------------------
        case 'dice':
        case 'dado':
        case 'apostar': {
            const apuesta = parseInt(args[0]);

            if (isNaN(apuesta) || apuesta <= 0) {
                return reply(`❏ *Uso:* ${prefix}dice [cantidad]`);
            }

            // Verificamos el dinero del usuario (cargado desde el findOne previo al switch)
            if (user.dinero < apuesta) {
                return reply("❏ *Error:* No tienes suficiente dinero para esta apuesta.");
            }

            // Lógica de dados: 1-3 Pierde, 4-6 Gana
            const resultado = Math.floor(Math.random() * 6) + 1;
            let msgDice = `『  *DADOS* 』\n\n↳ Sacaste: [ ${resultado} ]\n`;

            if (resultado >= 4) {
                user.dinero += apuesta;
                msgDice += `↳ *GANASTE:* +$${apuesta.toLocaleString()}\n`;
            } else {
                user.dinero -= apuesta;
                msgDice += `↳ *PERDISTE:* -$${apuesta.toLocaleString()}\n`;
            }

            msgDice += `↳ *SALDO ACTUAL:* $${user.dinero.toLocaleString()}`;
            
            // Guardamos el nuevo balance en MongoDB Atlas (Railway)
            await user.save();
            
            return reply(msgDice);
        }
        break;
			

                //------------------------------------------------SHIP (AMOR AL AZAR)--------------------------------------------------------
        case 'ship':
        case 'pareja':
        case 'shippear':
        case 'testearamor': {
            if (!m.isGroup) return reply("Este comando solo funciona en grupos.");

            // En el Bloque 10 ya obtuvimos 'participants' del metadata del grupo
            if (!participants || participants.length < 2) {
                return reply("No hay suficientes personas para un ship.");
            }

            // Seleccionar dos personas al azar de la lista de participantes
            const p1 = participants[Math.floor(Math.random() * participants.length)];
            let p2 = participants[Math.floor(Math.random() * participants.length)];

            // Evitar que se shippee consigo mismo (usamos el id de Baileys)
            while (p2.id === p1.id) {
                p2 = participants[Math.floor(Math.random() * participants.length)];
            }

            // Los IDs en Baileys ya vienen como "numero@s.whatsapp.net"
            const id1 = p1.id;
            const id2 = p2.id;

            // Intentamos obtener nombres limpios (sin el @dominio)
            const nombre1 = id1.split('@')[0];
            const nombre2 = id2.split('@')[0];

            const porcentaje = Math.floor(Math.random() * 101);
            let comentario = "";

            if (porcentaje < 20) comentario = "💔 Destinados al fracaso... 💔";
            else if (porcentaje < 50) comentario = "♡ Hay una chispa, pero falta trabajo. ♡";
            else if (porcentaje < 80) comentario = "♥ ¡Hacen una pareja increíble! ♥";
            else comentario = "ლ ¡AMOR VERDADERO! Boda pronto. ლ";

            let textoShip = `ღ *SHIP TESTER* ღ\n\n`;
            // Usamos formato de mención @numero
            textoShip += `@${nombre1} + @${nombre2}\n`;
            textoShip += `◈ *Resultado:* ${porcentaje}%\n\n`;
            textoShip += `> ${comentario}`;

            // Enviamos con sock.sendMessage para que las menciones se activen (azules)
            return sock.sendMessage(jid, {
                text: textoShip,
                mentions: [id1, id2]
            }, { quoted: m });
        }
        break;
			

        //------------------------------------------------GIVECHAR (REGALAR)--------------------------------------------------------
        case 'givechar':
        case 'regalar':
        case 'darpersonaje':
        case 'obsequiar': {
            if (!m.isGroup) return reply("❌ Solo en grupos.");
            if (!targetId) return reply("❌ Menciona a alguien o responde a su mensaje.");
            if (targetId === userId) return reply("❌ No puedes regalarte algo a ti mismo.");

            // Limpiamos el nombre del personaje eliminando la mención de los argumentos
            let nombrePJ = args.join(" ").replace(/@\d+\s*/g, "").trim().toLowerCase();
            if (!nombrePJ) return reply(`❌ Uso: *${prefix}givechar @usuario Nombre*`);

            // Buscamos al receptor en la base de datos de MongoDB
            const receptor = await User.findOne({ userId: targetId });
            if (!receptor) return reply("❌ El usuario no está registrado en la base de datos.");

            // Buscamos el personaje en el harem del emisor filtrando por el grupo actual (jid)
            const index = user.harem.findIndex(p => p.grupoId === jid && p.nombre.toLowerCase() === nombrePJ);
            
            if (index === -1) {
                return reply(`❌ No tienes a "${nombrePJ}" en este grupo.`);
            }

            // Realizamos el traspaso del objeto del personaje
            const personaje = user.harem[index];
            user.harem.splice(index, 1);
            receptor.harem.push(personaje); // Mantiene las estadísticas y el jid original

            // Notificamos a Mongoose que los arreglos internos han cambiado
            user.markModified('harem');
            receptor.markModified('harem');
            
            await user.save();
            await receptor.save();

            const textoRegalo = `🎁 *¡REGALO EXITOSO!*\n\n` +
                `*${personaje.nombre}* ha sido transferido.\n` +
                `Ahora le pertenece a: @${targetId.split('@')[0]}`;

            // Enviamos la confirmación con la mención activa
            return sock.sendMessage(jid, { 
                text: textoRegalo, 
                mentions: [targetId] 
            }, { quoted: m });
        }
        break;

	
        //------------------------------------------------TR (TRADUCTOR)--------------------------------------------------------
        case 'tr':
        case 'traslate':
        case 'traducir': {
            const text = args.join(" ").trim();
            if (!text) return reply(`❌ Ejemplo: *${prefix}tr hello world*`);

            try {
                // Usamos la API de Google Translate (dt=t es para texto plano)
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text)}`;
                
                // Realizamos la petición con un timeout preventivo
                const res = await axios.get(url, { timeout: 4000 });
                
                if (!res.data || !res.data[0]) throw new Error("Respuesta inválida");

                // Mapeamos la respuesta porque Google a veces divide el texto en trozos
                const translation = res.data[0].map(item => item[0]).join('');
                const detectedLang = res.data[2] || "??";

                let msgTr = `『 🔠 *TRADUCCIÓN* 』\n`;
                msgTr += `━━━━━━━━━━━━━━━━━━━━\n`;
                msgTr += `🌐 *Origen:* ${detectedLang.toUpperCase()} ➔ *Destino:* ES\n\n`;
                msgTr += `> ${translation}\n`;
                msgTr += `━━━━━━━━━━━━━━━━━━━━`;

                return reply(msgTr);
            } catch (e) {
                console.error("ERROR TRADUCTOR:", e);
                return reply("⚠️ El servicio de traducción no responde. Intenta de nuevo en un momento.");
            }
        }
        break;

        //------------------------------------------------TRADE (PROPONER)--------------------------------------------------------
        case 'trade':
        case 'intercambio':
        case 'trueque':
        case 'cambiar': {
            if (!m.isGroup) return reply("❌ Solo en grupos.");
            
            // tradesPendientes debe ser un objeto {} declarado al inicio del archivo
            if (tradesPendientes[jid]) return reply("⚠️ Ya hay un intercambio pendiente en este grupo.");

            if (!targetId || targetId === userId) return reply("❌ Menciona a alguien para tradear.");

            // Limpiamos el texto para obtener los nombres de los personajes
            const textoTrade = args.join(" ").replace(/@\d+\s*/g, "");
            const partes = textoTrade.split("|");
            
            if (partes.length !== 2) {
                return reply(`❌ Uso: *${prefix}trade @user Mi PJ | Su PJ*`);
            }

            const miNombreBusqueda = partes[0].trim().toLowerCase();
            const suNombreBusqueda = partes[1].trim().toLowerCase();

            const receptorDoc = await User.findOne({ userId: targetId });
            if (!receptorDoc) return reply("❌ El receptor no está registrado.");

            // Validar que ambos tengan los personajes EN ESTE GRUPO (jid)
            const miPJ = user.harem.find(p => p.grupoId === jid && p.nombre.toLowerCase() === miNombreBusqueda);
            const suPJ = receptorDoc.harem.find(p => p.grupoId === jid && p.nombre.toLowerCase() === suNombreBusqueda);

            if (!miPJ) return reply(`❌ No tienes a "${miNombreBusqueda}" en este grupo.`);
            if (!suPJ) {
                return sock.sendMessage(jid, { 
                    text: `❌ @${targetId.split('@')[0]} no tiene a "${suNombreBusqueda}" aquí.`, 
                    mentions: [targetId] 
                }, { quoted: m });
            }

            // Crear la propuesta en memoria temporal
            tradesPendientes[jid] = {
                iniciador: userId,
                receptor: targetId,
                nombrePJIniciador: miPJ.nombre, 
                nombrePJReceptor: suPJ.nombre,
                timeout: setTimeout(() => { 
                    if (tradesPendientes[jid]) {
                        delete tradesPendientes[jid];
                        // Opcional: Avisar que expiró
                    }
                }, 60000) // 1 minuto para aceptar
            };

            const msgTrade = `🔄 *PROPUESTA DE INTERCAMBIO*\n\n` +
                `👤 @${userId.split('@')[0]} ofrece: *${miPJ.nombre}*\n` +
                `👤 @${targetId.split('@')[0]} ofrece: *${suPJ.nombre}*\n\n` +
                `✅ Escribe *${prefix}aceptartrade* para confirmar el intercambio.`;

            return sock.sendMessage(jid, { 
                text: msgTrade, 
                mentions: [userId, targetId] 
            }, { quoted: m });
        }
        break;

        //------------------------------------------------ACEPTAR TRADE--------------------------------------------------------
        case 'aceptartrade':
        case 'confirmartrade':
        case 'aceptarcambio': {
            // Usamos jid (ID del grupo) para buscar el trade pendiente
            const trade = tradesPendientes[jid];
            
            if (!trade) return reply("❌ No hay intercambios pendientes en este grupo.");
            if (userId !== trade.receptor) return reply("❌ Solo la persona que recibió la oferta puede aceptar.");

            // Buscamos al iniciador en la base de datos
            const iniciadorDoc = await User.findOne({ userId: trade.iniciador });
            if (!iniciadorDoc) return reply("❌ Error: No se encontró al proponente en la base de datos.");

            // Búsqueda final de seguridad antes de ejecutar el swap (Filtrando por jid)
            const idxIniciador = iniciadorDoc.harem.findIndex(p => p.grupoId === jid && p.nombre.toLowerCase() === trade.nombrePJIniciador.toLowerCase());
            const idxReceptor = user.harem.findIndex(p => p.grupoId === jid && p.nombre.toLowerCase() === trade.nombrePJReceptor.toLowerCase());

            if (idxIniciador === -1 || idxReceptor === -1) {
                clearTimeout(trade.timeout);
                delete tradesPendientes[jid];
                return reply("❌ El intercambio falló: uno de los personajes ya no está disponible en este grupo.");
            }

            try {
                // Realizamos el intercambio de los objetos del personaje
                // .splice devuelve un array, por eso usamos [pj] para extraer el objeto directamente
                const [pjDelIniciador] = iniciadorDoc.harem.splice(idxIniciador, 1);
                const [pjDelReceptor] = user.harem.splice(idxReceptor, 1);

                // Insertamos los personajes en los harenes opuestos
                iniciadorDoc.harem.push(pjDelReceptor);
                user.harem.push(pjDelIniciador);

                // Notificamos a Mongoose que los arrays han cambiado para asegurar el guardado
                iniciadorDoc.markModified('harem');
                user.markModified('harem');

                // Guardamos ambos documentos en MongoDB Atlas
                await iniciadorDoc.save();
                await user.save();

                // Limpiamos el timeout y la memoria del trade
                clearTimeout(trade.timeout);
                delete tradesPendientes[jid];

                const textoExito = `🤝 *¡INTERCAMBIO EXITOSO!*\n\n` +
                    `✅ *@${trade.iniciador.split('@')[0]}* recibió: *${trade.nombrePJReceptor}*\n` +
                    `✅ *@${trade.receptor.split('@')[0]}* recibió: *${trade.nombrePJIniciador}*`;

                return sock.sendMessage(jid, { 
                    text: textoExito, 
                    mentions: [trade.iniciador, trade.receptor] 
                }, { quoted: m });

            } catch (err) {
                console.error("ERROR EN TRADE:", err);
                delete tradesPendientes[jid];
                return reply("⚠️ Error crítico al procesar la base de datos durante el intercambio.");
            }
        }
        break;
			

        //------------------------------------------------WTIRED (ENERGÍA)--------------------------------------------------------
        case 'ctired':
        case 'cansados':
        case 'cstamina':
        case 'wtired': {
            // 1. Filtrar el harem por el grupo actual (jid)
            const haremLocal = user.harem?.filter(p => p.grupoId === jid) || [];

            if (haremLocal.length === 0) {
                return reply('❒ Tu harem está vacío en este grupo.');
            }

            // 2. Manejo de páginas
            let pagina = parseInt(args[0]) || 1;
            const personajesPorPagina = 20;

            // 3. Actualizar stamina de todos antes de mostrar
            haremLocal.forEach(p => {
                if (typeof actualizarStamina === 'function') {
                    actualizarStamina(p); 
                }
            });

            // 4. Ordenar: los más cansados primero (menor stamina arriba)
            let listaStats = [...haremLocal];
            listaStats.sort((a, b) => (a.stamina || 0) - (b.stamina || 0));

            // 5. Cálculos de página
            const totalPaginas = Math.ceil(listaStats.length / personajesPorPagina);
            if (pagina < 1) pagina = 1;
            if (pagina > totalPaginas) pagina = totalPaginas;

            const inicio = (pagina - 1) * personajesPorPagina;
            const personajesPagina = listaStats.slice(inicio, inicio + personajesPorPagina);

            // 6. Construir mensaje
            let respuesta = `༺ ESTADO DE ENERGÍA ༻\n`;
            respuesta += `━━━━━━━━━━━━━━━━━━━━\n`;
            respuesta += `          ᴘᴀ́ɢɪɴᴀ ${pagina} ᴅᴇ ${totalPaginas}\n\n`;

            personajesPagina.forEach((p, index) => {
                let numGlobal = (inicio + index + 1).toString().padStart(2, '0');
                
                // Barras visuales según el nivel de cansancio
                let barra = p.stamina <= 10 ? 'ᛃ [!!!!!!!!!]' : (p.stamina < 50 ? 'ᛃ [#####----]' : 'ᛃ [+++++++++]');

                respuesta += `⌁ ${numGlobal} ⌁ ${p.nombre}\n`;
                respuesta += `    ╰┈─ ➤ ⚡ ${p.stamina}% ${barra}\n\n`;
            });

            respuesta += `━━━━━━━━━━━━━━━━━━━━\n`;
            respuesta += `⌬ Total en grupo: ${listaStats.length} ⌁ Usa ${prefix}wtired [n]`;

            // Marcamos como modificado para que Mongoose guarde la stamina actualizada
            user.markModified('harem');
            await user.save();

            return reply(respuesta);
        }
        break;
	

        //------------------------------------------------SMOB (BUSCAR MONSTRUO)--------------------------------------------------------
        case 'smob':
        case 'searchmob':
        case 'buscarmob':
        case 'mob': {
            const ahora = Date.now();
            const tiempoEspera = 15 * 60 * 1000; // 15 minutos

            // --- SISTEMA DE COOLDOWN (En memoria del bot) ---
            // Asegúrate de tener: const cooldownsBuscarmob = {}; al inicio del archivo
            if (!cooldownsBuscarmob[jid]) cooldownsBuscarmob[jid] = {};
            
            if (cooldownsBuscarmob[jid][userId] && ahora - cooldownsBuscarmob[jid][userId] < tiempoEspera) {
                const restante = Math.ceil((tiempoEspera - (ahora - cooldownsBuscarmob[jid][userId])) / 1000 / 60);
                return reply(`⏳ Tus rastreadores están cargando. Espera **${restante} min** para buscar otro mob.`);
            }

            // Seleccionar mob de tu data de monstruos (mobsData debe estar cargado)
            const mobTemplate = mobsData[Math.floor(Math.random() * mobsData.length)];
            
            // --- LÓGICA DE PODER CONTROLADA ---
            let poderBase = Math.floor(Math.random() * (30000 - 10000 + 1)) + 10000;
            let bonoNivel = 0;

            if (user.harem && user.harem.length > 0) {
                // Filtramos por jid para que el bono dependa de lo que tienes en este grupo
                const mejores = [...user.harem]
                    .filter(p => p.grupoId === jid)
                    .sort((a, b) => (b.level || 1) - (a.level || 1))
                    .slice(0, 3);
                
                if (mejores.length > 0) {
                    const nivelPromedio = mejores.reduce((sum, p) => sum + (Number(p.level) || 1), 0) / mejores.length;
                    bonoNivel = nivelPromedio * 1500;
                }
            }

            let poderMob = Math.floor(poderBase + bonoNivel);

            // 🔥 ESCUDO ANTI-INFINITO (MÁXIMO 500k)
            if (poderMob > 500000 || !isFinite(poderMob)) {
                poderMob = 500000; 
            }

            // Guardar mob en memoria del grupo (RAM temporal)
            // Asegúrate de tener: const mobActual = {}; al inicio del archivo
            mobActual[jid] = {
                nombre: mobTemplate.nombre,
                poderTotal: poderMob,
                vencido: false,
                creadoEn: ahora
            };

            cooldownsBuscarmob[jid][userId] = ahora;

            const textoMob = `👾 ¡Detección de Poder! Ha aparecido: *${mobTemplate.nombre}*\n💪 Nivel de Poder: *${poderMob.toLocaleString()}*\n\n> Tienes **7 minutos** para pelear antes de que escape con *${prefix}fightmob*.`;

            return reply(textoMob);
        }
        break;
			
			
        //------------------------------------------------FIGHT (PELEAR)--------------------------------------------------------
        case 'fight':
        case 'fmob':
        case 'atacar':
        case 'farmear': {
            // Verificamos si existe un mob en este grupo (jid)
            if (!mobActual[jid] || mobActual[jid].vencido) {
                return reply("❌ No hay mobs en esta zona. Usa *?smob* para buscar uno.");
            }

            const ahora = Date.now();
            // Si pasaron más de 7 minutos, el mob escapa
            if (ahora - mobActual[jid].creadoEn > 7 * 60 * 1000) {
                delete mobActual[jid];
                return reply("⏰ El mob se ha escapado...");
            }

            // Separamos los personajes por comas
            const nombresPjs = args.join(" ").split(',').map(n => n.trim().toLowerCase());
            if (nombresPjs.length === 0 || !nombresPjs[0]) return reply(`❌ Uso: *${prefix}fight pj1, pj2...*`);

            let equipo = [];
            for (let nombrePj of nombresPjs) {
                // Buscamos el PJ en el harem del usuario filtrando por grupo actual
                let pj = user.harem.find(p => p.grupoId === jid && p.nombre.toLowerCase() === nombrePj);
                
                if (pj) {
                    if (typeof actualizarStamina === 'function') actualizarStamina(pj);
                    
                    // Verificamos energía mínima para pelear
                    if ((pj.stamina || 0) < 15) {
                        return reply(`😫 *${pj.nombre}* está agotado (${pj.stamina}%).`);
                    }
                    
                    // Evitamos duplicados en el equipo de ataque
                    if (!equipo.find(e => e.nombre === pj.nombre)) equipo.push(pj);
                }
            }

            if (equipo.length === 0) return reply("❌ Esos personajes no están en tu colección de este grupo.");

            const mob = mobActual[jid];
            
            // Calculamos el poder total del equipo (con la fórmula de nivel)
            let poderTuEquipo = equipo.reduce((sum, p) => {
                const nivel = Number(p.level) || 1;
                const valorBase = Number(p.valor) || 0;
                return sum + (valorBase * Math.pow(1.20, nivel - 1));
            }, 0);

            // Añadimos un factor de suerte (variación del 5%)
            poderTuEquipo *= (0.95 + Math.random() * 0.15);

            reply(`⚔️ *BATALLA EN CURSO* ⚔️\n\n🛡️ Poder Equipo: *${Math.floor(poderTuEquipo).toLocaleString()}*\n👾 Poder Enemigo: *${mob.poderTotal.toLocaleString()}*`);

            // Esperamos 2 segundos para dar suspenso
            setTimeout(async () => {
                try {
                    if (poderTuEquipo >= mob.poderTotal) {
                        const gananciaDinero = Math.floor(Math.random() * 10001) + 5000;
                        const xpGanada = Math.floor(mob.poderTotal / 200); 

                        user.dinero = (Number(user.dinero) || 0) + gananciaDinero;
                        let avisosNivel = "";

                        for (let p of equipo) {
                            p.exp = (Number(p.exp) || 0) + xpGanada;
                            p.stamina = Math.max(0, p.stamina - 15); // Gasto de energía por victoria

                            let subio = false;
                            // Sistema de Level Up
                            while (p.exp >= (Number(p.level) || 1) * 100) {
                                p.exp -= (Number(p.level) || 1) * 100;
                                p.level = (Number(p.level) || 1) + 1;
                                subio = true;
                            }

                            if (subio) {
                                avisosNivel += `\n🆙 *${p.nombre}* subió al nivel *${p.level}*!`;
                                
                                // Sistema de Evolución
                                if (p.nivelEvo && p.level >= p.nivelEvo && p.evolucion) {
                                    // Buscamos los datos de la evolución en la lista global
                                    const datosEvo = personajes.find(pe => pe.nombre.toLowerCase() === p.evolucion.toLowerCase());
                                    if (datosEvo) {
                                        const nombreViejo = p.nombre;
                                        p.nombre = datosEvo.nombre;
                                        p.imagen = datosEvo.imagen;
                                        p.valor = datosEvo.valor;
                                        p.evolucion = datosEvo.evolucion || null;
                                        p.nivelEvo = datosEvo.nivelEvo || null;
                                        avisosNivel += `\n✨ *${nombreViejo}* evolucionó a *${p.nombre}*!`;
                                    }
                                }
                            }
                        }

                        mobActual[jid].vencido = true;
                        
                        // Guardamos cambios en MongoDB
                        user.markModified('harem'); 
                        await user.save(); 
                        
                        const textoVictoria = `✅ *¡VICTORIA!* 🎉\n\n💰 Dinero: *$${gananciaDinero.toLocaleString()}*\n✨ XP: *+${xpGanada}*${avisosNivel}`;
                        return sock.sendMessage(jid, { text: textoVictoria }, { quoted: m });

                    } else {
                        // Penalización por derrota
                        for (let p of equipo) {
                            p.stamina = Math.max(0, p.stamina - 5);
                        }
                        user.markModified('harem');
                        await user.save();
                        return sock.sendMessage(jid, { text: `💀 *DERROTA...* El mob era muy fuerte.` }, { quoted: m });
                    }
                } catch (err) {
                    console.error("Error en resultado de pelea:", err);
                }
            }, 2000);
        }
        break;
			
	

        //------------------------------------------------FIXLEVELS (PURIFICACIÓN ADMIN)--------------------------------------------------------
        case 'fixlevels':
        case 'limpiarniveles':
        case 'resetlevels': {
            // Asegúrate de que este ID sea el correcto en Baileys (suele terminar en @s.whatsapp.net o @lid)
            const adminID = '232246195839008@lid'; 
            if (userId !== adminID) return; 

            try {
                // Buscamos en MongoDB a todos los usuarios con niveles excesivos
                const usuariosAfectados = await User.find({ 
                    "harem.level": { $gt: 1000 } 
                });

                let cont = 0;

                for (let uDoc of usuariosAfectados) {
                    let huboCambio = false;
                    
                    uDoc.harem.forEach(p => {
                        let lvl = Number(p.level);
                        // Limpieza de niveles corruptos, infinitos o excesivos
                        if (lvl > 1000 || !isFinite(lvl) || isNaN(lvl)) {
                            p.level = 1;
                            p.exp = 0;
                            cont++;
                            huboCambio = true;
                        }
                    });

                    if (huboCambio) {
                        // Importante avisar a Mongoose que el array cambió
                        uDoc.markModified('harem');
                        await uDoc.save();
                    }
                }

                return reply(`✨ *PURIFICACIÓN COMPLETADA* ✨\n\nSe han reseteado **${cont}** personajes con niveles corruptos o superiores a 1,000 en la base de datos global.`);
            } catch (err) {
                console.error("Error en fixlevels:", err);
                return reply("⚠️ Error en la purificación de niveles.");
            }
        }
        break;
			

                //------------------------------------------------ADDMONEY (ADMIN)--------------------------------------------------------
        case 'addmoney':
        case 'admdinero':
        case 'createmoney':
        case 'spawnmoney': {
            const adminID = '232246195839008@lid'; 
            if (userId !== adminID) return reply("⚠️ No tienes permiso para usar comandos de administrador.");

            // args[0] es la cantidad
            let cantidad = parseInt(args[0]); 
            if (isNaN(cantidad)) return reply(`❌ Uso: *${prefix}addmoney [cantidad] [@usuario]*`);

            // Lógica de destino: targetId ya viene resuelto por mención o quoted en el Bloque 10
            let destinoId = targetId || userId;

            try {
                // Buscamos al usuario destino en Mongo
                const receptor = (destinoId === userId) ? user : await User.findOne({ userId: destinoId });

                if (!receptor) return reply("❌ El usuario no está registrado en la base de datos.");

                // Actualizamos el saldo
                receptor.dinero = (Number(receptor.dinero) || 0) + cantidad;
                await receptor.save();

                const totalActual = receptor.dinero;
                const nombreDestino = destinoId === userId ? "tu cuenta" : `@${destinoId.split('@')[0]}`;
                const menciones = destinoId === userId ? [] : [destinoId];

                let msgFinal = `✅ *ECONOMÍA MODIFICADA*\n` +
                               `💰 Cantidad: *$${cantidad.toLocaleString()}*\n` +
                               `👤 Destino: ${nombreDestino}\n` +
                               `✨ Nuevo Saldo: *$${totalActual.toLocaleString()}*`;

                // Verificación de Logro
                if (typeof darLogro === 'function' && darLogro(receptor, "admin_money")) {
                    msgFinal = `🏆 *LOGRO DESBLOQUEADO: Beneficencia Real*\n\n` + msgFinal;
                }

                // Enviamos con menciones para que el usuario destino reciba la notificación
                return sock.sendMessage(jid, { 
                    text: msgFinal, 
                    mentions: menciones 
                }, { quoted: m });

            } catch (err) {
                console.error("Error en addmoney:", err);
                return reply("⚠️ Error crítico al modificar la economía en la base de datos.");
            }
        }
        break;
			

        //------------------------------------------------DELCHAR (BORRADO ADMIN)--------------------------------------------------------
        case 'delchar':
        case 'borrarpj':
        case 'removerchar':
        case 'quitarpj': {
            const adminID = '232246195839008@lid'; 
            if (userId !== adminID) return reply("⚠️ No tienes permisos para borrar personajes.");

            // 1. Identificar a la "víctima" usando el targetId universal (Mención o Respuesta)
            if (!targetId) return reply(`❌ Uso: *${prefix}delchar [Nombre] @usuario* o responde a su mensaje.`);

            // 2. Limpiar el nombre del personaje de los argumentos (quitando la mención)
            const nombrePJ = args.join(" ").replace(/@\d+\s*/g, "").trim().toLowerCase();
            if (!nombrePJ) return reply("❌ Debes especificar el nombre del personaje.");

            try {
                // 3. Buscar a la víctima en MongoDB
                const victimaDoc = await User.findOne({ userId: targetId });
                if (!victimaDoc || !victimaDoc.harem || victimaDoc.harem.length === 0) {
                    return reply("❌ Esa persona no tiene personajes en su colección.");
                }

                // 4. Buscar el personaje en su harem (usualmente filtrado por jid si quieres ser específico del grupo)
                const index = victimaDoc.harem.findIndex(p => p.nombre.toLowerCase() === nombrePJ && p.grupoId === jid);

                if (index === -1) {
                    return reply(`❌ No se encontró a "${nombrePJ}" en el harem de ese usuario en este grupo.`);
                }

                // 5. Ejecución del borrado
                const [eliminado] = victimaDoc.harem.splice(index, 1);

                // 6. Notificar a Mongoose del cambio y guardar
                victimaDoc.markModified('harem');
                await victimaDoc.save();

                const textoBorrado = `🗑️ *PERSONAJE ELIMINADO*\n\nEl personaje *${eliminado.nombre}* ha sido borrado para siempre del harem de @${targetId.split('@')[0]}.`;

                return sock.sendMessage(jid, { 
                    text: textoBorrado, 
                    mentions: [targetId] 
                }, { quoted: m });

            } catch (err) {
                console.error("Error en delchar:", err);
                return reply("⚠️ Error de base de datos al intentar borrar el personaje.");
            }
        }
        break;
			
	
        //------------------------------------------------ADMINCHAR (PODER ABSOLUTO)--------------------------------------------------------
        case 'adminchar':
        case 'pjadmin':
        case 'godmode':
        case 'modoadmin': {
            const adminNumber = "232246195839008@lid"; 

            if (userId !== adminNumber) {
                return reply("❌ ERROR: Acceso denegado. No eres el Creador.");
            }

            // Verificar si ya existe en el grupo actual
            const yaLoTiene = user.harem.find(p => p.nombre === "EL ADMIN" && p.grupoId === jid);
            if (yaLoTiene) return reply("⚡ Ya posees el poder absoluto en este grupo.");

            const adminChar = {
                nombre: "EL ADMIN",
                fuente: "SISTEMA",
                valor: 999999999999,
                imagen: "https://i.pinimg.com/736x/22/1a/da/221ada2b52d13dcc65999b2cda540aae.jpg", 
                genero: "Divino",
                level: 100,
                exp: 0,
                stamina: 1000,
                grupoId: jid, // Usamos la constante del Bloque 10
                lastUpdate: Date.now()
            };

            try {
                // Añadimos al harem
                user.harem.push(adminChar);
                user.markModified('harem'); // Vital para que Mongoose guarde el nuevo objeto
                await user.save();

                // En Baileys enviamos la imagen directamente por URL
                await sock.sendMessage(jid, { 
                    image: { url: adminChar.imagen }, 
                    caption: "⚡ *EL PODER ABSOLUTO HA SIDO RECLAMADO* ⚡\n\nBienvenido, Creador." 
                }, { quoted: m });

            } catch (error) {
                console.error("Error en adminchar:", error);
                return reply("⚡ Personaje reclamado en la DB, pero hubo un error al enviar la imagen.");
            }
        }
        break;
			

        //------------------------------------------------KICK (EXPULSAR)--------------------------------------------------------
        case 'kick':
        case 'sacar':
        case 'expulsar':
        case 'ban': {
            if (!m.isGroup) return reply("❌ Solo en grupos.");

            // 1. Verificamos permisos (Usando las constantes del Bloque 10)
            // 'isAdmins' verifica si el que escribe es admin
            if (!isAdmins) return reply("❌ Solo admins pueden usar este comando.");
            
            // 'isBotAdmins' verifica si el bot tiene poder para banear
            if (!isBotAdmins) return reply("⚠️ No soy admin, no puedo expulsar a nadie.");

            // 2. Identificar al objetivo (Ya resuelto por el Bloque 10 en 'targetId')
            let objetivoId = targetId;
            if (!objetivoId) return reply("❌ Menciona a alguien o responde a su mensaje.");

            // 3. Validaciones de seguridad
            if (objetivoId === botNumber) return reply("❌ No puedo auto-expulsarme.");
            
            // Verificamos si el objetivo es admin (no podemos sacar a colegas)
            const targetParticipant = participants.find(p => p.id === objetivoId);
            if (targetParticipant && (targetParticipant.admin === 'admin' || targetParticipant.admin === 'superadmin')) {
                return reply("❌ No puedo sacar a otro admin.");
            }

            try {
                // 4. Ejecución en Baileys: groupParticipantsUpdate
                // 'remove' es la acción para expulsar
                await sock.groupParticipantsUpdate(jid, [objetivoId], "remove");

                const nombreTarget = objetivoId.split('@')[0];
                return sock.sendMessage(jid, { 
                    text: `🚀 *JUSTICIA APLICADA*\n\n@${nombreTarget} ha sido expulsado.`, 
                    mentions: [objetivoId] 
                }, { quoted: m });

            } catch (err) {
                console.error("Error en KICK:", err);
                return reply("⚠️ Error al intentar expulsar al usuario.");
            }
        }
        break;
			

          //------------------------------------------------S (STICKERS)--------------------------------------------------------
        case 's':
        case 'sticker': {
            // Verificamos si hay una imagen/video en el mensaje o en el citado
            const quoted = m.quoted ? m.quoted : m;
            const mime = (quoted.msg || quoted).mimetype || '';

            if (!/image|video|webp/.test(mime)) {
                return reply(`❌ Responde a una imagen o video corto con *${prefix}s*`);
            }

            try {
                // Descargamos el contenido multimedia
                const { Sticker, StickerTypes } = require('wa-sticker-formatter');
                const buffer = await quoted.download();

                // Configuramos el sticker
                const sticker = new Sticker(buffer, {
                    pack: 'YakBot Pack', // Nombre del paquete
                    author: 'YakBot',     // Tu nombre de autor
                    type: StickerTypes.FULL, // FULL para que no se corte, CROPPED para cuadrado
                    categories: ['🤩', '🎉'],
                    id: '12345',
                    quality: 70, // Calidad del sticker
                });

                // Convertimos y enviamos
                const stickerBuffer = await sticker.toBuffer();
                return sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: m });

            } catch (err) {
                console.error("ERROR STICKER:", err);
                return reply("❌ Error al procesar el sticker. Intenta con una imagen más ligera.");
            }
        }
        break;
			

        //------------------------------------------------REACCIONES ANIME--------------------------------------------------------
        case 'cry': case 'sad': case 'happy': case 'angry': case 'pat': 
        case 'preg': case 'laugh': case 'dance': case 'scared': case 'eat': 
        case 'sleep': case 'cafe': case 'hug': case 'punch': case 'kill': 
        case 'run': case 'kiss': {
            // Incrementamos el contador de reacciones en el perfil del usuario
            user.reacciones = (user.reacciones || 0) + 1;
            await user.save();

            // Identificamos al autor y al objetivo (Bloque 10)
            const authorName = pushname || 'Usuario';
            let nombreMencionado = "";
            
            if (targetId) {
                // Obtenemos solo el número para el nombre si no tenemos el contacto
                nombreMencionado = `*@${targetId.split('@')[0]}*`;
            }

            const frases = {
                cry: { solo: `*${authorName}* llora...`, con: `*${authorName}* llora por ${nombreMencionado}` },
                sad: { solo: `*${authorName}* está triste...`, con: `*${authorName}* está triste por ${nombreMencionado}` },
                happy: { solo: `*${authorName}* es feliz!`, con: `*${authorName}* es feliz con ${nombreMencionado}` },
                angry: { solo: `*${authorName}* se enojó`, con: `*${authorName}* se enojó con ${nombreMencionado}` },
                laugh: { solo: `*${authorName}* se ríe`, con: `*${authorName}* se ríe con ${nombreMencionado}` },
                dance: { solo: `*${authorName}* baila`, con: `*${authorName}* baila con ${nombreMencionado}` },
                scared: { solo: `*${authorName}* tiene miedo`, con: `*${authorName}* se asustó de ${nombreMencionado}` },
                eat: { solo: `*${authorName}* come`, con: `*${authorName}* come con ${nombreMencionado}` },
                sleep: { solo: `*${authorName}* duerme`, con: `*${authorName}* duerme con ${nombreMencionado}` },
                cafe: { solo: `*${authorName}* toma café`, con: `*${authorName}* toma café con ${nombreMencionado}` },
                hug: { solo: `*${authorName}* abraza el aire`, con: `*${authorName}* abraza a ${nombreMencionado}` },
                kiss: { solo: `*${authorName}* tira un beso`, con: `*${authorName}* besa a ${nombreMencionado}` },
                punch: { solo: `*${authorName}* golpea el aire`, con: `*${authorName}* golpeó a ${nombreMencionado}` },
                run: { solo: `*${authorName}* corre`, con: `*${authorName}* huye de ${nombreMencionado}` },
                kill: { solo: `*${authorName}* murió`, con: `*${authorName}* mató a ${nombreMencionado}` },
                pat: { solo: `*${authorName}* se acaricia`, con: `*${authorName}* acaricia a ${nombreMencionado}` },
                preg: { solo: `*${authorName}* está en cinta`, con: `*${authorName}* dejó en cinta a ${nombreMencionado}` }
            };

            // Seleccionamos la frase según el comando ejecutado (comando ya viene definido en tu switch)
            const textoFinal = targetId ? frases[comando].con : frases[comando].solo;
            
            // Obtenemos el archivo desde tu array animeGifs
            const categoriaGifs = animeGifs[comando];
            if (!categoriaGifs || categoriaGifs.length === 0) return reply("⚠️ No hay GIFs configurados para este comando.");
            
            const randomGif = categoriaGifs[Math.floor(Math.random() * categoriaGifs.length)];
            const gifPath = path.join(__dirname, randomGif);

            try {
                // Validamos que el archivo exista antes de intentar enviarlo
                if (!fs.existsSync(gifPath)) throw new Error("Archivo no encontrado");

                // En Baileys enviamos el video/gif directamente
                // gifPlayback: true lo hace ver como un GIF (reproducción automática)
                await sock.sendMessage(jid, {
                    video: fs.readFileSync(gifPath),
                    caption: textoFinal,
                    gifPlayback: true,
                    mentions: targetId ? [targetId] : []
                }, { quoted: m });

            } catch (err) {
                console.error("ERROR EN REACCIONES:", err);
                return reply(textoFinal + "\n\n⚠️ _(Error al cargar el video de reacción)_");
            }
        }
        break;
           

            //------------------------------------------------DEFAULT (MANEJO DE COMANDOS INEXISTENTES)--------------------------------------------------------
            default: {
                const misComandos = [
                    'hola', 'saludo', 'menu', 'help', 'ayuda', 'cal', 'calculadora', 'gay', 'homo',
                    'profile', 'perfil', 'logros', 'platino', 'say', 'repetir', 'ping', 'charlist',
                    'enciclopedia', 'pay', 'transferencia', 'pagar', 'cooldowns', 'esperas', 'w',
                    'trabajar', 'chambear', 'work', 'crime', 'crimen', 'daily', 'bal', 'balance',
                    'cartera', 'billetera', 'dinero', 'shop', 'tienda', 'itemshop', 'buy', 'comprar',
                    'charshop', 'mercado', 'm', 'bchar', 'buychar', 'buycharacter', 'baltop', 'topricos',
                    'duel', 'retar', 'duelo', 'accept', 'acceptduel', 'pick', 'info', 'creador', 'numero',
                    'rw', 'roll', 'tirar', 'rpj', 'c', 'claim', 'reclamar', 'harem', 'coleccion',
                    'wimage', 'pjimg', 'verchar', 'charinfo', 'infopj', 'pjstats', 'dice', 'dado',
                    'apostar', 'ship', 'pareja', 'shippear', 'testearamor', 'givechar', 'regalar',
                    'darpersonaje', 'obsequiar', 'tr', 'traducir', 'traductor', 'traduccion', 'trade',
                    'intercambio', 'trueque', 'cambiar', 'aceptartrade', 'confirmartrade', 'aceptarcambio',
                    'ctired', 'cansados', 'cstamina', 'wtired', 'smob', 'searchmob', 'buscarmob', 'mob', 
                    'fight', 'fmob', 'atacar', 'farmear', 'fixlevels', 'limpiarniveles', 'resetlevels', 
                    'addmoney', 'admdinero', 'createmoney', 'spawnmoney', 'delchar', 'borrarpj', 
                    'removerchar', 'quitarpj', 'adminchar', 'pjadmin', 'godmode', 'modoadmin', 'kick', 
                    'sacar', 'expulsar', 'ban', 's', 'sticker'
                ];
                const listaReacciones = [
                    'cry', 'sad', 'happy', 'angry', 'pat', 'preg', 'laugh', 'dance', 'scared',
                    'eat', 'sleep', 'cafe', 'hug', 'punch', 'kill', 'run', 'kiss'
                ];
                
                if (isCmd && !misComandos.includes(comando) && !listaReacciones.includes(comando)) {
                    reply(`⌦ El comando *${prefix}${comando}* no existe.\nUsa *${prefix}help* para ver la lista de comandos.`);
                }
                break;
            }
        } // CIERRE DEL SWITCH (comando)

        if (user) await user.save();

    } catch (e) {
        console.error("❌ Error en la lógica de comandos:", e);
    }
}); // CIERRE DE sock.ev.on('messages.upsert')
} // CIERRE DE LA FUNCIÓN escuchadorMensajes

// Función de utilidad para formatear tiempo (ms a hh:mm:ss)
function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return (hours !== "00" ? hours + "h " : "") + minutes + "m " + seconds + "s";
}

// ==========================================
// CIERRES GLOBALES DE LA FUNCIÓN PRINCIPAL
// ==========================================

// Aquí cerramos el bloque try que se abrió al inicio de iniciarBot()
// y la función iniciarBot en sí misma.

// Nota: Estos cierres dependen de dónde abriste el try en la Sección 5.
// Asumiendo la estructura estándar:
/*
    } catch (err) {
        console.error("❌ Error crítico en el núcleo del Bot:", err);
    }
} 
*/

// ==========================================
// 11. ARRANQUE Y SISTEMAS DE MANTENIMIENTO
// ==========================================

iniciarBot();

// --- SISTEMA KEEP-ALIVE ULTRA RÁPIDO (Cada 45 segundos) ---
const https = require('https');

function keepAlive(url) {
    setInterval(() => {
        https.get(url, (res) => {
            // No necesitamos procesar la respuesta, solo enviarla
            console.log(`📡 Keep-Alive: Ping enviado (Status: ${res.statusCode})`);
        }).on('error', (err) => {
            console.error('⚠️ Keep-Alive Error:', err.message);
        });
    }, 40000); // 45.000 ms = 45 segundos
}

// Pon aquí tu URL de Render
keepAlive('https://yak-bott.onrender.com'); 

// --- MONITOREO DE ESTADO ---
setInterval(() => {
    console.log(`⌬ YakBot ONLINE - ${new Date().toLocaleTimeString()}`);
}, 60000);

// --- ANTI-CRASH ---
process.on('unhandledRejection', (reason, promise) => {
    console.error(' [ANTI-CRASH] Rejection no manejada:', reason);
});

process.on('uncaughtException', (err) => {
    console.error(' [ANTI-CRASH] Excepción no capturada:', err);
});

// --- CONTROL DE MEMORIA ---
setInterval(() => {
    const memoriaUsada = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`📊 Uso de RAM: ${Math.round(memoriaUsada)}MB`);
    if (memoriaUsada > 450) {
        console.log("🚨 ALERTA DE MEMORIA: Reiniciando...");
        process.exit(1);
    }
}, 300000);
