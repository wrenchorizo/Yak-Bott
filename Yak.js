// ==========================================
// 1. POLIFILLS Y MÓDULOS
// ==========================================
if (!global.File) {
    const { Blob } = require('buffer');
    global.File = class extends Blob {
        constructor(parts, filename, options = {}) {
            super(parts, options);
            this.name = filename;
            this.lastModified = options.lastModified || Date.now();
        }
    };
}

const mongoose = require('mongoose');
const { Client, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const sharp = require('sharp');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const play = require('play-dl');
const { exec } = require('child_process');
const axios = require('axios');
const dns = require('dns');
const http = require('http');

ffmpeg.setFfmpegPath(ffmpegPath);
dns.setServers(['8.8.8.8', '8.8.4.4']);

// ==========================================
// 2. ESQUEMAS DE MONGODB (TU BASE DE DATOS)
// ==========================================

// Harem por Grupo
const haremSchema = new mongoose.Schema({
    idUnico: { type: String, required: true, unique: true }, // userId + grupoId
    userId: String,
    grupoId: String,
    personajes: { type: Array, default: [] }
});
const Harem = mongoose.model('Harem', haremSchema);

// Usuarios, Economía y Perfiles
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    dinero: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    mensajes: { type: Number, default: 0 },
    comandos: { type: Number, default: 0 },
    lastWork: { type: Number, default: 0 },
	lastDaily: { type: Number, default: 0 },
rachaDaily: { type: Number, default: 0 },
    lastCrime: { type: Number, default: 0 },
	lastRW: { type: Number, default: 0 },
lastClaim: { type: Number, default: 0 },
lastSmob: { type: Number, default: 0 },
    logros: { type: Array, default: [] }
});
const User = mongoose.model('User', userSchema);

// Tienda de personajes por grupo
const charShopSchema = new mongoose.Schema({
    grupoId: { type: String, required: true, unique: true },
    personajes: { type: Array, default: [] },
    ultimaActualizacion: { type: Number, default: 0 }
});
const CharShop = mongoose.model('CharShop', charShopSchema);

// ==========================================
// 3. VARIABLES GLOBALES Y DATOS ESTATICOS
// ==========================================
const MONGO_URI = process.env.MONGO_URL;

const logrosInfo = {
    cmd_500: "Veterano de Comandos (500 usos)",
    cmd_1000: "Adicto al Bot (1,000 usos)",
    cmd_10000: "Leyenda Viviente (10,000 usos)",
    cmd_50000: "DIOS de los Comandos (50,000 usos)",
    three_am: "Insomnio Activo (3 AM)",
    money_100k: "Ahorrador (100k)",
    money_1m: "Millonario (1M)",
    money_10m: "Magnate (10M)",
    money_100m: "Dueño del Mundo (100M)",
    chars_15: "Coleccionista Principiante (15 personajes)",
    chars_30: "Dueño de Harem (30 personajes)",
    chars_50: "Comandante de Almas (50 personajes)",
    chars_100: "Soberano del Harem (100 personajes)"
};

const mobsData = [
    { nombre: 'Zombies salvages', lvls: [5, 9], desc: 'Protestan por tu presencia.' },
    { nombre: 'Mentes manipuladas ultra mejoradas', lvls: [10, 50], desc: 'Un zumbido molesto pero letal.' },
    { nombre: 'Esqueletos infernales', lvls: [100, 500], desc: 'Huesos crujientes que buscan pelea.' },
    { nombre: 'Robots de ultron', lvls: [1000, 3500], desc: 'Cerebros... y tu dinero.' },
    { nombre: 'Devastadores', lvls: [5000, 8000], desc: 'Máquinas de destrucción masiva.' },
    { nombre: 'Piratas con recompensas altas', lvls: [10000, 12000], desc: 'Buscadores de tesoros del Grand Line.' },
    { nombre: 'Ejército de Viltrumitas', lvls: [15000, 17000], desc: 'Omni-man estaría orgulloso.' },
    { nombre: 'Soldados de Freezer', lvls: [20000, 30000], desc: 'La élite galáctica del emperador.' },
    { nombre: 'Celestiales errantes', lvls: [30000, 60000], desc: 'Entidades cósmicas fuera de control.' },
    { nombre: 'Guerreros Universales', lvls: [70000, 100000], desc: 'Los más fuertes de todos los universos.' }
];

// Variables en memoria (Volátiles)
let cooldownsBuscarmob = {}; 
let mobActual = {};
const procesandoRW = new Set();
const duelosActivos = {};
const tradesPendientes = {};

// ==========================================
// 4. FUNCIONES DE APOYO (HELPERS)
// ==========================================

function msToTime(ms) {
    const minutos = Math.floor(ms / 60000);
    const segundos = Math.floor((ms % 60000) / 1000);
    return `${minutos}m ${segundos}s`;
}

// Eliminamos "guardarHarem" y "guardarEconomia" porque 
// ahora usaremos await user.save() directamente.

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function actualizarStamina(personaje) {
    if (personaje.level === undefined) personaje.level = 1;
    if (personaje.stamina === undefined) personaje.stamina = 100;
    if (personaje.lastUpdate === undefined) personaje.lastUpdate = Date.now();

    const ahora = Date.now();
    const tiempoPasado = ahora - personaje.lastUpdate;
    
    // Recupera 10% cada 30 minutos
    const porcionRecuperada = Math.floor(tiempoPasado / 1800000) * 10;
    
    if (porcionRecuperada > 0) {
        personaje.stamina = Math.min(100, personaje.stamina + porcionRecuperada);
        personaje.lastUpdate = ahora; 
    }
    return personaje;
}

// Servidor de Salud para Railway
http.createServer((req, res) => {
  res.write('YakBot está vivo');
  res.end();
}).listen(process.env.PORT || 3000);

// Anti-Crash
process.on('unhandledRejection', (reason) => console.error(' [ANTI-CRASH] Rechazo:', reason));
process.on('uncaughtException', (err) => console.error(' [ANTI-CRASH] Excepción:', err));

// ==========================================
// 5. INICIO DE EJECUCIÓN
// ==========================================
(async () => {

// Cliente
// ==========================================
// 6. CONEXIÓN A MONGO Y ARRANQUE DEL CLIENTE (CON QR LINK)
// ==========================================

mongoose.connect(MONGO_URI || process.env.MONGO_URL).then(async () => {
    console.log('✅ Conectado a MongoDB Atlas');
    
    const store = new MongoStore({ mongoose: mongoose });

    client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000 
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--no-zygote', 
                '--single-process'
            ],
            executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
        }
    });

    // --- EVENTO QR (TERMINAL + LINK EXTERNO) ---
    client.on('qr', (qr) => {
        console.log('⚡ NUEVO CÓDIGO QR GENERADO:');
        // Genera el QR en consola por si acaso
        qrcode.generate(qr, { small: true });
        
        // Genera el link para abrir en el navegador (Mucho más fiable)
        const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
        console.log(`🔗 ESCANEA AQUÍ SI EL DE ARRIBA SE VE MAL:\n${qrLink}`);
    });

    client.on('ready', () => {
        console.log('✅ YakBot listo y conectado');
        if (fs.existsSync('./.wwebjs_cache')) {
            fs.rmSync('./.wwebjs_cache', { recursive: true, force: true });
        }
    });

    client.on('remote_session_saved', () => {
        console.log('💾 Sesión guardada en MongoDB correctamente');
    });

	
// ---------------- VARIABLES GLOBALES & MODELOS ----------------
// ==========================================
// 7. LÓGICA DE PERSONAJES Y TIENDA (MIGRADO)
// ==========================================

// Base de datos estática de personajes
const personajes = JSON.parse(fs.readFileSync("./personajes.json", "utf8"));


async function obtenerHarem(userId, grupoId) {
    const idUnico = `${userId}_${grupoId}`;
    let h = await Harem.findOne({ idUnico });
    if (!h) {
        h = new Harem({ 
            idUnico, 
            userId, 
            grupoId, 
            personajes: [] 
        });
    }
    return h;
}

async function actualizarCharShop(grupoId, forzar = false) {
    const ahora = Date.now();
    const tiempoRotacion = 3000000; // 50 minutos

    let shop = await CharShop.findOne({ grupoId });
    if (!shop) shop = new CharShop({ grupoId });

    if (forzar || (ahora - shop.ultimaActualizacion >= tiempoRotacion)) {
        // Buscamos todos los personajes atrapados en este grupo
        const haremsDelGrupo = await Harem.find({ grupoId });
        const nombresEnHarem = haremsDelGrupo.flatMap(h => 
            h.personajes.map(p => p.nombre.toLowerCase())
        );

        // Filtramos los disponibles de la base de datos general
        const disponibles = personajes.filter(p => !nombresEnHarem.includes(p.nombre.toLowerCase()));
        const copiaDisponibles = [...disponibles];
        const nuevosPersonajes = [];

        for (let i = 0; i < 5; i++) {
            if (copiaDisponibles.length === 0) break;
            const indexAleatorio = Math.floor(Math.random() * copiaDisponibles.length);
            const pBase = copiaDisponibles.splice(indexAleatorio, 1)[0];
            const valorBase = parseInt(pBase.valor) || 0;
            
            let precioFinal;
            if (valorBase >= 17000) {
                precioFinal = 700000 + Math.floor(Math.random() * 300001);
            } else if (valorBase >= 5000) {
                precioFinal = 250000 + Math.floor(Math.random() * 250000);
            } else {
                precioFinal = 15000 + Math.floor((valorBase / 5000) * 200000);
            }

            nuevosPersonajes.push({ ...pBase, precio: precioFinal });
        }

        shop.personajes = nuevosPersonajes;
        shop.ultimaActualizacion = ahora;
        await shop.save();
    }
    return shop;
}

// ==========================================
// 8. VARIABLES DE SESIÓN (EN MEMORIA)
// ==========================================
// Estas se limpian si el bot se reinicia (ideal para estados temporales)
const duelosActivos = {};
const tradesPendientes = {};
const cooldownsBuscarmob = {}; 
const mobActual = {};
const procesandoRW = new Set();
const tiradasTemporales = {};
const cooldownsRW = {};
const cooldownsC = {};

// ==========================================
// 9. HELPERS ADICIONALES
// ==========================================

function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60);
    let minutes = Math.floor((duration / (1000 * 60)) % 60);
    return `${minutes}m ${seconds}s`;
}

/**
 * Selecciona un personaje al azar con probabilidad inversa a su valor
 * (Los más caros son más difíciles de obtener).
 */
function personajeRandom(listaPersonajes) {
    const filtrados = listaPersonajes.filter(p => p.nombre !== 'Deadpool');
    if (filtrados.length === 0) return null;

    const total = filtrados.reduce((sum, p) => sum + (100000 - Number(p.valor || 0)), 0);
    let rnd = Math.random() * total;

    for (let p of filtrados) {
        rnd -= (100000 - Number(p.valor || 0));
        if (rnd <= 0) return p;
    }
    return filtrados[filtrados.length - 1];
}
	
// ==========================================
// 10. ÚNICO MANEJADOR DE MENSAJES (FUSIONADO)
// ==========================================

client.on('message_create', async (message) => {
    // 1. Filtros básicos
    if (message.fromMe) return;
    
    const prefix = '?'; 
    if (!message.body.startsWith(prefix)) return;

    // 2. Definiciones de variables de mando
    const args = message.body.slice(prefix.length).trim().split(/ +/);
    const comando = args.shift().toLowerCase();
    const userId = message.author || message._data.participant || message.from;
    const grupoId = message.from;
    const pushname = message._data.notifyName || "Usuario";

    // 3. Detección de Target (Menciones o Respuestas)
    let targetId = null;
    if (message.mentionedIds && message.mentionedIds.length > 0) {
        targetId = message.mentionedIds[0];
    } else if (message.hasQuotedMsg) {
        const quotedMsg = await message.getQuotedMessage();
        targetId = quotedMsg.author || quotedMsg.from;
    }

    // 4. Filtro de Bot encendido/apagado por grupo
    if (message.isGroup) {
        if (!botSettings[grupoId]) botSettings[grupoId] = { enabled: true };
        // Permitimos el comando 'bot' para poder encenderlo
        if (!botSettings[grupoId].enabled && comando !== 'bot') return;
    }

    // Importación de fetch para comandos que lo necesiten
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

    // 5. Carga y actualización de Usuario en MongoDB
    let user = await User.findOne({ userId });
    if (!user) {
        user = new User({ userId });
        await user.save();
    }

    // Actualización de estadísticas
    user.mensajes += 1;
    user.xp += 2;

    // Lógica de niveles
    const xpNecesaria = user.level * 100;
    if (user.xp >= xpNecesaria) {
        user.xp -= xpNecesaria;
        user.level += 1;
        message.reply(`⭐ ¡Subiste al nivel *${user.level}*!`);
    }

    // 6. Sistema de Logros
    // Comandos realizados
    const hitosComandos = { 500: "cmd_500", 1000: "cmd_1000", 10000: "cmd_10000", 50000: "cmd_50000" };
    if (hitosComandos[user.comandos] && !user.logros.includes(hitosComandos[user.comandos])) {
        user.logros.push(hitosComandos[user.comandos]);
        message.reply(`🏆 Logro desbloqueado: *${logrosInfo[hitosComandos[user.comandos]]}*`);
    }

    // Insomnio (3 AM)
    const horaActual = new Date().getHours();
    if (horaActual === 3 && !user.logros.includes("three_am")) {
        user.logros.push("three_am");
        message.reply(`🏆 Logro desbloqueado: *${logrosInfo["three_am"]}*`);
    }

    // Dinero acumulado
    const hitosDinero = [
        { val: 100000, id: "money_100k" },
        { val: 1000000, id: "money_1m" },
        { val: 10000000, id: "money_10m" },
        { val: 100000000, id: "money_100m" }
    ];
    for (let h of hitosDinero) {
        if (user.dinero >= h.val && !user.logros.includes(h.id)) {
            user.logros.push(h.id);
            message.reply(`🏆 Logro desbloqueado: *${logrosInfo[h.id]}*`);
        }
    }

    // Logros de Harem (Solo en comandos específicos para ahorrar recursos)
    const comandosHarem = ['harem', 'c', 'buy', 'trade', 'givechar'];
    if (comandosHarem.includes(comando)) {
        let userHarem = await obtenerHarem(userId, grupoId);
        const cantChars = userHarem.personajes.length;
        const hitosChars = { 15: "chars_15", 30: "chars_30", 50: "chars_50", 100: "chars_100" };
        if (hitosChars[cantChars] && !user.logros.includes(hitosChars[cantChars])) {
            user.logros.push(hitosChars[cantChars]);
            message.reply(`🏆 Logro desbloqueado: *${logrosInfo[hitosChars[cantChars]]}*`);
        }
    }

    // Guardado de progreso antes de procesar el comando
    await user.save();

    // 7. Lógica de Deadpool Errante
    if (Math.random() < 0.05) { 
        let haremsGrupo = await Harem.find({ grupoId, "personajes.0": { $exists: true } });
        if (haremsGrupo.length > 1) {
            await Harem.updateMany({ grupoId }, { $pull: { personajes: { nombre: 'Deadpool' } } });

            let nuevoDueño = haremsGrupo[Math.floor(Math.random() * haremsGrupo.length)];
            const deadpoolObj = {
                nombre: "Deadpool", fuente: "Marvel", valor: 696969, 
                imagen: "https://i.pinimg.com/736x/dd/91/76/dd9176fa6d3699a754a8ae5c3d518b32.jpg",
                level: 102, stamina: 100, lastUpdate: Date.now()
            };

            nuevoDueño.personajes.push(deadpoolObj);
            await nuevoDueño.save();

            const frasesDP = [
                "¡Hola! El harem anterior olía a calzones usados, así que me mudé aquí.",
                "Ahora soy un inmigrante ilegal en tu harem...",
                "¡Hey tú! Sí, el de la pantalla. Acabo de entrar en tu harem. No te acostumbres."
            ];
            const frase = frasesDP[Math.floor(Math.random() * frasesDP.length)];
            const numeroLimpio = nuevoDueño.userId.split('@')[0];
            
            await client.sendMessage(grupoId, `🔴 *DEADPOOL:* ${frase}\n\n_¡Deadpool ha saltado al harem de @${numeroLimpio}!_`, {
                mentions: [nuevoDueño.userId]
            });
        }
    }





// ==========================================
// --------- COMANDOS BÁSICOS ---------
// ==========================================

    switch (comando) {
        case 'hola':
		case 'saludo': {
        return message.reply('Hola, soy YakBot ☽\nMucho gusto! ^^');
		}
		break;

//------------------------------------------------MENU / HELP--------------------------------------------------------
        case 'menu':
        case 'help':
        case 'ayuda': {
            const menuText = `『 *MENÚ DE YAKBOT* 』

✦ *GACHA & RPG*
⌬ ${prefix}rw | ${prefix}roll
> Tira un personaje aleatorio (15 min CD).
⌬ ${prefix}c | ${prefix}claim
> Reclama el personaje (20 min CD).
⌬ ${prefix}harem [n]
> Tu colección (20 por página).
⌬ ${prefix}wtired [n]
> Energía y cansancio de tu harem.
⌬ ${prefix}charinfo [Nombre]
> Stats detallados: Nivel, EXP y Poder Real.
⌬ ${prefix}wimage [Nombre]
> Muestra la imagen de un personaje.
⌬ ${prefix}charlist [Fuente]
> Lista de personajes disponibles por serie.
⌬ ${prefix}givechar @usuario [Nombre]
> Regala un personaje de tu harem.
⌬ ${prefix}trade @usuario [MiChar] | [SuChar]
> Intercambio de personajes.
⌬ ${prefix}aceptartrade
> Aceptar un trade pendiente.
⌬ ${prefix}smob
> Busca mobs para pelear contra ellos.
⌬ ${prefix}fight p1, p2, p3
> Pelea contra los mobs que salieron en smob.

✧ *PVP 3v3 (NIVELES)*
⌬ ${prefix}duel @usuario | ${prefix}duelo
> Reta a alguien (5 min para aceptar).
⌬ ${prefix}accept
> Acepta el duelo pendiente.
⌬ ${prefix}pick [c1, c2, c3]
> Elige equipo. ¡Los niveles aumentan tu poder!

✦ *ECONOMÍA & TIENDAS*
⌬ ${prefix}w | ${prefix}trabajar
> Trabaja para ganar dinero (1 min CD).
⌬ ${prefix}crime
> Intenta un crimen (5 min CD).
⌬ ${prefix}daily
> Recompensa diaria (Reset 9 PM).
⌬ ${prefix}bal | ${prefix}balance
> Consulta tu dinero actual.
⌬ ${prefix}pay [cantidad] @usuario
> Transfiere dinero a otro usuario.
⌬ ${prefix}dice [cantidad]
> Apuesta tu dinero al dado.
⌬ ${prefix}charshop | ${prefix}mercado
> Mercado rotativo de personajes nuevos.
⌬ ${prefix}bchar [número]
> Compra un personaje del mercado.
⌬ ${prefix}shop | ${prefix}tienda
> Tienda de objetos (Pociones, XP, Evolución).
⌬ ${prefix}buy [número] [nombre]
> Compra y usa un objeto en un personaje.
⌬ ${prefix}cooldowns
> Consulta tus tiempos de espera.

✧ *REACCIONES ANIME*
⌁ ${prefix}cry | ${prefix}sad | ${prefix}happy | ${prefix}angry
⌁ ${prefix}laugh | ${prefix}run | ${prefix}dance | ${prefix}scared
⌁ ${prefix}eat | ${prefix}sleep | ${prefix}cafe
⌁ ${prefix}punch @user | ${prefix}kill @user | ${prefix}pat @user
⌁ ${prefix}preg @user | ${prefix}hug @user | ${prefix}kiss @user

⊹ *DIVERSIÓN*
⌬ ${prefix}gay
> Calcula qué tan gay es alguien.

✦ *STICKERS*
⌬ ${prefix}s | ${prefix}sticker
> Convierte imagen, GIF o video en sticker.

✧ *ADMIN & OTROS*
⌬ ${prefix}kick | ${prefix}tr | ${prefix}say | ${prefix}cal
⌬ ${prefix}hola | ${prefix}ping | ${prefix}info | ${prefix}creador`;

            return message.reply(menuText);
        }
        break;


//------------------------------------------------CALCULATOR--------------------------------------------------------
        case 'cal':
		case 'calculadora': {
            const operacionRaw = message.body.slice(prefix.length + 3).trim();
            if (!operacionRaw) {
                return message.reply(`『 🧮 *CALCULADORA* 』\n\nUso: *${prefix}cal [operación]*\n\n*Soportados:* \n√ , π , ÷ , × , ± , %\nExponentes: ² , ³ , ⁴ ... ⁿ\nFracciones: ½ , ¼ , ¾\n\n_Ejemplo: ${prefix}cal √64 + ½_`);
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
                    return message.reply("❌ *Error:* Caracteres no permitidos detectados.");
                }

                const resultado = eval(operacion);
                const resultadoFinal = Number.isInteger(resultado) 
                    ? resultado.toLocaleString() 
                    : parseFloat(resultado.toFixed(4)).toLocaleString();

                return message.reply(`『 🧮 *RESULTADO* 』\n\n✨ *Entrada:* ${operacionRaw}\n✅ *Cálculo:* ${resultadoFinal}`);
            } catch (e) {
                return message.reply("❌ *Error:* Operación inválida.");
            }
        }
			break;
//------------------------------------------------GAY--------------------------------------------------------
        case 'gay': {
            if (!targetId) return message.reply(`Uso: ${prefix}gay @usuario o responde a su mensaje.`);
            const usuarioMencionado = `@${targetId.split('@')[0]}`;

            message.reply("ꕤ Calculando nivel de gay...");

            setTimeout(() => {
                let porcentaje = Math.random() < 0.15 
                    ? Math.floor(Math.random() * 1000000000) 
                    : Math.floor(Math.random() * 100) + 1;

                client.sendMessage(grupoId, `🏳️‍🌈 Resultado:\n${usuarioMencionado} es *${porcentaje}%* gay`, { 
                    mentions: [targetId] 
                });
            }, 2500);
            break;
        }


//------------------------------------------------PROFILE--------------------------------------------------------
        case 'profile':
        case 'perfil': {
            // Buscamos al usuario o al mencionado
            const idParaVer = targetId || userId;
            let p = await User.findOne({ userId: idParaVer });
            if (!p) p = new User({ userId: idParaVer });

            const contacto = await client.getContactById(idParaVer);
            const nombre = contacto.pushname || contacto.name || "Usuario";
            const xpNecesaria = p.level * 100;

            let texto = `👤 *PERFIL DE ${nombre.toUpperCase()}*\n\n`;
            texto += `⭐ *Nivel:* ${p.level}\n`;
            texto += `✨ *XP:* ${p.xp} / ${xpNecesaria}\n`;
            texto += `💬 *Mensajes:* ${p.mensajes}\n`;
                texto += `💰 *Dinero:* $${p.dinero.toLocaleString()}\n`;
            texto += `🏆 *Logros:* ${p.logros.length}\n`;

            try {
                const fotoUrl = await contacto.getProfilePicUrl();
                if (fotoUrl) {
                    const media = await MessageMedia.fromUrl(fotoUrl);
                    await client.sendMessage(grupoId, media, { caption: texto });
                } else {
                    await message.reply(texto);
                }
            } catch (err) {
                await message.reply(texto);
            }
            break;
        }

//------------------------------------------------LOGROS--------------------------------------------------------
        case 'logros':
		case 'platino': {
            const idParaVer = targetId || userId;
            let p = await User.findOne({ userId: idParaVer });
            
            if (!p || p.logros.length === 0) {
                return message.reply(targetId ? "Este usuario no tiene logros." : "No tienes logros todavía.");
            }

            let texto = "🏆 *TUS LOGROS*\n\n";
            p.logros.forEach(l => {
                texto += `• ${logrosInfo[l] || l}\n`;
            });

            return message.reply(texto);
			
        break;
		}
	
//------------------------------------------------SAY (REPETIDOR)--------------------------------------------------------
        case 'say':
		case 'repetir': {
            const loQueDijo = message.body.slice(prefix.length + 3).trim();

            if (!loQueDijo) {
                return message.reply("❌ Debes escribir algo para que yo lo repita. Ejemplo: *?say hola*");
            }

            return client.sendMessage(grupoId, loQueDijo);
        }
        break;

        //------------------------------------------------PING (ESTADO)--------------------------------------------------------
        case 'ping': {
            const latencia = Date.now() - (message.timestamp * 1000);
            const memoria = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2); 
            
            return message.reply(`¡Pong!\n\n> *Latencia:* ${latencia}ms\n> *RAM:* ${memoria} MB\n> *Estado:* Online`);
        }
        break;

        //------------------------------------------------CHARLIST (ENCICLOPEDIA)--------------------------------------------------------
        case 'charlist':
		case 'enciclopedia': {
            const filtroFuente = args.join(" ").trim();

            // Si NO escribe fuente → mostrar resumen de series disponibles
            if (!filtroFuente) {
                const fuentes = {};

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

                return message.reply(respuesta);
            }

            // Si SÍ escribe fuente → mostrar personajes de esa serie
            const filtrados = personajes.filter(p =>
                p.fuente.toLowerCase() === filtroFuente.toLowerCase()
            );

            if (filtrados.length === 0) {
                return message.reply("❌ No se encontró esa fuente en la base de datos.");
            }

            let respuesta = `『 📜 *${filtroFuente.toUpperCase()}* 』\n\n`;
            respuesta += `Total: ${filtrados.length} personajes\n\n`;

            // Listado simple de nombres
            filtrados.forEach(p => {
                respuesta += `• ${p.nombre}\n`;
            });

            return message.reply(respuesta);
        }
        break;

//------------------------------------------------PAY (TRANSFERENCIA)--------------------------------------------------------
        case 'pay':
		case 'transferencia':
		case 'pagar': {
            try {
                if (!message.isGroup) {
                    return message.reply("❌ Este comando solo funciona en grupos.");
                }

                const partes = message.body.trim().split(/\s+/);
                if (partes.length < 3) {
                    return message.reply(`💡 Uso: *${prefix}pay cantidad @usuario*`);
                }

                const cantidad = parseInt(partes[1]);
                if (isNaN(cantidad) || cantidad <= 0) {
                    return message.reply("❌ Cantidad inválida.");
                }

                if (!targetId) {
                    return message.reply("❌ Debes mencionar a alguien o responder a su mensaje.");
                }

                if (targetId === userId) {
                    return message.reply("😂 No puedes pagarte a ti mismo, genio.");
                }

                let receptor = await User.findOne({ userId: targetId });
                if (!receptor) {
                    receptor = new User({ userId: targetId });
                    await receptor.save();
                }

                if (user.dinero < cantidad) {
                    return message.reply("💸 No tienes suficiente dinero para esta transferencia.");
                }

                user.dinero -= cantidad;
                receptor.dinero += cantidad;

                await user.save();
                await receptor.save();

                const numero = targetId.split("@")[0];
                return message.reply(
                    `『 💸 *TRANSFERENCIA EXITOSA* 』\n\n` +
                    `✅ Enviaste *$${cantidad.toLocaleString()}* a @${numero}\n` +
                    `💰 Tu balance actual: *$${user.dinero.toLocaleString()}*`,
                    { mentions: [targetId] }
                );

            } catch (err) {
                console.log("ERROR EN PAY:", err);
                return message.reply("❌ Ocurrió un error al procesar el pago.");
            }
        }
        break;

        //------------------------------------------------COOLDOWNS (SISTEMA PERSISTENTE)--------------------------------------------------------
        case 'cooldowns':
		case 'esperas': {
            const ahora = Date.now();
            let texto = "『 ◔ *TUS COOLDOWNS* 』\n\n";
            let hayCooldowns = false;

            // Tiempos configurados (en milisegundos)
            const tiempos = {
                rw: 15 * 60 * 1000,
                c: 20 * 60 * 1000,
                smob: 15 * 60 * 1000,
                work: 60 * 1000,
                crime: 5 * 60 * 1000
            };

            // Estructura de chequeo: [Nombre, Propiedad en DB, Duración total]
            const listaChequeo = [
                ["✨ rw", "lastRW", tiempos.rw],
                ["🫴 c", "lastClaim", tiempos.c],
                ["👾 smob", "lastSmob", tiempos.smob],
                ["💼 work", "lastWork", tiempos.work],
                ["🧨 crime", "lastCrime", tiempos.crime]
            ];

            listaChequeo.forEach(([nombre, prop, duracion]) => {
                const transcurrido = ahora - (user[prop] || 0);
                if (transcurrido < duracion) {
                    texto += `${nombre}: ${msToTime(duracion - transcurrido)}\n`;
                    hayCooldowns = true;
                }
            });

            if (!hayCooldowns) {
                texto += "❏ No tienes cooldowns activos.";
            }

            return message.reply(texto);
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

            if (ahora - (user.lastWork || 0) < cooldown) {
                const restante = cooldown - (ahora - (user.lastWork || 0));
                return message.reply(`◔ Espera *${msToTime(restante)}* para volver a trabajar.`);
            }

            const ganancia = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
            user.dinero += ganancia;
            user.lastWork = ahora;
            user.comandos += 1; // Para el sistema de logros

            await user.save();
            return message.reply(`⌨️ Has trabajado con éxito.\n\n💵 Ganaste: *$${ganancia.toLocaleString()}*\n💰 Balance Total: *$${user.dinero.toLocaleString()}*`);
        }
        break;

        //------------------------------------------------CRIME (CRIMEN)--------------------------------------------------------
        case 'crime':
		case 'crimen': {
            const ahora = Date.now();
            const cooldown = 5 * 60 * 1000; // 5 minutos

            if (ahora - (user.lastCrime || 0) < cooldown) {
                const restante = cooldown - (ahora - (user.lastCrime || 0));
                return message.reply(`◔ Espera *${msToTime(restante)}* para intentar otro crimen.`);
            }

            const exito = Math.random() < 0.5;
            user.lastCrime = ahora;
            user.comandos += 1;

            if (exito) {
                const ganancia = Math.floor(Math.random() * (7000 - 5000 + 1)) + 5000;
                user.dinero += ganancia;
                await user.save();
                return message.reply(`✪ *¡CRIMEN EXITOSO!* ✪\n\n🕵️‍♂️ Lograste el golpe perfecto.\n💵 Ganaste: *$${ganancia.toLocaleString()}*\n💰 Balance actual: *$${user.dinero.toLocaleString()}*`);
            } else {
                const perdida = Math.floor(Math.random() * (6000 - 4000 + 1)) + 4000;
                user.dinero = Math.max(0, user.dinero - perdida);
                await user.save();
                return message.reply(`👮‍♂️ *¡TE ATRAPARON!* 👮‍♂️\n\nLa policía te confiscó el equipo.\n📉 Perdiste: *$${perdida.toLocaleString()}*\n💰 Balance actual: *$${user.dinero.toLocaleString()}*`);
            }
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
                return message.reply(`⏳ Ya reclamaste tu daily.\nRegresa en *${msToTime(faltante)}* (9:00 PM).`);
            }

            // 2. Lógica de Racha (Streak)
            // Si el último reclamo fue hace más de 48h desde el hito anterior, se pierde la racha
            const limiteRacha = ultimoHito9PM.getTime() - msPorDia;
            if (lastDailyTime < limiteRacha) {
                user.rachaDaily = 1;
            } else {
                user.rachaDaily = Math.min(50, (user.rachaDaily || 0) + 1);
            }

            // 3. Cálculo de Premio (Día 1: 10k -> Día 50: 200k)
            // Fórmula: 10,000 + (racha-1) * (190,000 / 49)
            const base = 10000;
            const incremento = Math.floor((user.rachaDaily - 1) * (190000 / 49));
            const premioFinal = base + incremento;

            user.dinero += premioFinal;
            user.lastDaily = ahora.getTime();
            await user.save();

            let rachaMsg = user.rachaDaily === 50 ? "🔥 ¡RACHA MÁXIMA ALCANZADA! 🔥" : `📈 Racha actual: *Día ${user.rachaDaily}*`;

            return message.reply(`『 🎁 *RECOMPENSA DIARIA* 』\n\n${rachaMsg}\n💰 Has recibido: *$${premioFinal.toLocaleString()}*\n\n_Vuelve mañana después de las 9:00 PM_`);
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
            if (!targetUser) targetUser = new User({ userId: idVer });

            const nombre = idVer === userId ? "TU BILLETERA" : "BILLETERA DEL USUARIO";
            return message.reply(`💰 *${nombre}*\n━━━━━━━━━━━━━━\n» Balance actual: *$${targetUser.dinero.toLocaleString()}*`);
        }
        break;

// ==========================================
//           SISTEMA DE TIENDA (SHOP)
// ==========================================

//------------------------------------------------SHOP (TIENDA DE OBJETOS)--------------------------------------------------------
        case 'shop':
		case 'tienda':
		case 'items': {
            let tabla = `🛒 *TIENDA DE LUJO YAKBOT*\n`;
            tabla += `━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            tabla += `1️⃣ *Poción de Energía* (⚡+50)\n`;
            tabla += `    ╰┈─ ➤ Precio: $15,000\n`;
            tabla += `    ╰┈─ ➤ Uso: ${prefix}buy 1 Nombre\n\n`;
            
            tabla += `2️⃣ *Amuleto Maestro* (✨+100 XP)\n`;
            tabla += `    ╰┈─ ➤ Precio: $35,000\n`;
            tabla += `    ╰┈─ ➤ Uso: ${prefix}buy 2 Nombre\n\n`;
            
            tabla += `3️⃣ *Piedra de Evolución* (⭐ +1 Nivel)\n`;
            tabla += `    ╰┈─ ➤ Precio: $80,000\n`;
            tabla += `    ╰┈─ ➤ Uso: ${prefix}buy 3 Nombre\n\n`;
            
            tabla += `4️⃣ *Bendición del Admin* (💖 +2 Niveles y Full Stamina)\n`;
            tabla += `    ╰┈─ ➤ Precio: $150,000\n`;
            tabla += `    ╰┈─ ➤ Uso: ${prefix}buy 4 Nombre\n\n`;
            
            tabla += `5️⃣ *Contrato Eterno* (📜 +50% Valor Base)\n`;
            tabla += `    ╰┈─ ➤ Precio: $300,000\n`;
            tabla += `    ╰┈─ ➤ Uso: ${prefix}buy 5 Nombre\n\n`;
            
            tabla += `━━━━━━━━━━━━━━━━━━━━\n`;
            tabla += `⌬ Tu Balance: *$${user.dinero.toLocaleString()}*`;
            
            return message.reply(tabla);
        }
        break;

        //------------------------------------------------BUY (COMPRAR OBJETOS)--------------------------------------------------------
        case 'buy':
		case 'comprar': {
            const itemNum = args[0];
            const targetName = args.slice(1).join(' ').toLowerCase().trim();

            if (!itemNum || !targetName) return message.reply(`❌ Uso: *${prefix}buy [número] [nombre del personaje]*`);

            // Buscamos al personaje en el harem del usuario (MongoDB)
            const personaje = user.harem.find(p => p.nombre.toLowerCase() === targetName);
            if (!personaje) return message.reply(`❌ No tienes a **${targetName}** en tu harem.`);

            const precios = { "1": 15000, "2": 35000, "3": 80000, "4": 150000, "5": 300000 };
            const costo = precios[itemNum];

            if (!costo) return message.reply("❌ Número de objeto inválido.");
            if (user.dinero < costo) return message.reply(`💸 No tienes suficiente dinero. Necesitas *$${costo.toLocaleString()}*.`);

            // Procesar el efecto del item
            user.dinero -= costo;

            if (itemNum === '1') {
                personaje.stamina = Math.min(100, (personaje.stamina || 0) + 50);
                message.reply(`🧪 *Poción* usada en ${personaje.nombre}. Stamina: ${personaje.stamina}%`);
            } 
            else if (itemNum === '2') {
                personaje.exp += 100;
                while (personaje.exp >= (personaje.level || 1) * 100) {
                    personaje.exp -= (personaje.level || 1) * 100;
                    personaje.level += 1;
                }
                message.reply(`✨ *Amuleto* usado. ${personaje.nombre} subió al nivel ${personaje.level}.`);
            } 
            else if (itemNum === '3') {
                personaje.level += 1;
                message.reply(`⭐ ¡${personaje.nombre} subió al nivel ${personaje.level} con la Piedra!`);
            } 
            else if (itemNum === '4') {
                personaje.stamina = 100;
                personaje.level += 2;
                message.reply(`💖 ¡${personaje.nombre} bendecido!\n🆙 +2 Niveles (Nivel: ${personaje.level})\n⚡ Energía al 100%`);
            } 
            else if (itemNum === '5') {
                personaje.valor = Math.floor(personaje.valor * 1.5);
                message.reply(`📜 *Contrato Eterno* firmado.\n📈 Valor de ${personaje.nombre} subió a *$${personaje.valor.toLocaleString()}*.`);
            }

            // --- LÓGICA DE EVOLUCIÓN AUTOMÁTICA ---
            // Buscamos si el personaje original en el JSON tiene evolución
            const dataOriginal = personajes.find(p => p.nombre.toLowerCase() === personaje.nombre.toLowerCase());
            
            if (dataOriginal && dataOriginal.evolucion && personaje.level >= dataOriginal.nivelEvo) {
                const datosEvo = personajes.find(pe => pe.nombre.toLowerCase() === dataOriginal.evolucion.toLowerCase());
                if (datosEvo) {
                    const nombreViejo = personaje.nombre;
                    personaje.nombre = datosEvo.nombre;
                    personaje.imagen = datosEvo.imagen;
                    personaje.valor = datosEvo.valor;
                    // No reseteamos nivel/exp a menos que tú lo quieras así
                    message.reply(`✨ ¡INCREÍBLE! *${nombreViejo}* ha evolucionado a... ¡*${personaje.nombre}*! 🎉`);
                }
            }

            await user.save();
        }
        break;

        //------------------------------------------------CHARSHOP (MERCADO ROTATIVO)--------------------------------------------------------
        case 'charshop':
		case 'mercado':
		case 'm': {
            // Esta función actualizarCharShop debe estar definida fuera del switch para manejar la RAM de la tienda
            actualizarCharShop(grupoId); 
            const shopDelGrupo = charShopsPorGrupo[grupoId];
            const tiempoRestante = 3000000 - (Date.now() - shopDelGrupo.ultimaActualizacion);
            
            let msg = `🏪 *MERCADO DE PERSONAJES*\n`;
            msg += `⏱️ Rotación en: ${msToTime(tiempoRestante)}\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

            if (shopDelGrupo.personajes.length === 0) {
                msg += "⚠️ No hay personajes en esta rotación.";
            } else {
                shopDelGrupo.personajes.forEach((p, i) => {
                    msg += `*${i + 1}* ⇢ *${p.nombre}*\n`;
                    msg += `╰┈─ ➤ *Costo:* $${p.precio.toLocaleString()} | *Fuente:* ${p.fuente}\n\n`;
                });
                msg += `_Usa *${prefix}bchar [número]* para comprar._\n`;
            }

            msg += `━━━━━━━━━━━━━━━━━━━━\n⌬ Tu Saldo: *$${user.dinero.toLocaleString()}*`;
            return message.reply(msg);
        }
        break;

        //------------------------------------------------BCHAR (COMPRAR PERSONAJE)--------------------------------------------------------
        case 'bchar':
		case 'buychar':
		case 'buycharacter': {
            actualizarCharShop(grupoId);
            const shopDelGrupo = charShopsPorGrupo[grupoId];
            const num = parseInt(args[0]);
            const indice = num - 1;

            if (isNaN(num) || !shopDelGrupo || !shopDelGrupo.personajes[indice]) {
                return message.reply("❌ Número inválido.");
            }

            const item = shopDelGrupo.personajes[indice];

            if (user.dinero < item.precio) {
                return message.reply(`❌ Dinero insuficiente. Te faltan *$${(item.precio - user.dinero).toLocaleString()}*.`);
            }

            // Transacción
            user.dinero -= item.precio;
            user.harem.push({
                nombre: item.nombre,
                fuente: item.fuente,
                valor: item.valor,
                imagen: item.imagen,
                level: 1,
                exp: 0,
                stamina: 100,
                obtencion: 'Comprado'
            });

            // Quitar de la tienda de este grupo
            shopDelGrupo.personajes.splice(indice, 1);

            await user.save();
            return message.reply(`🎉 ¡COMPRA EXITOSA!\n\nHas adquirido a: *${item.nombre}*\n💰 Saldo restante: *$${user.dinero.toLocaleString()}*`);
        }
        break;

//------------------------------------------------BALTOP (RANKING DE RIQUEZA)--------------------------------------------------------
        case 'baltop':
		case 'topricos': {
            try {
                // Buscamos los 10 usuarios con más dinero en la base de datos
                const topUsuarios = await User.find({})
                    .sort({ dinero: -1 }) // Ordenar de mayor a menor (-1)
                    .limit(10);           // Solo los primeros 10

                if (!topUsuarios || topUsuarios.length === 0) {
                    return message.reply("❌ No hay registros de economía todavía.");
                }

                let textoTop = "『 🏆 *RANKING DE RIQUEZA* 』\n";
                textoTop += "━━━━━━━━━━━━━━━━━━━━\n\n";
                
                let mentions = [];

                topUsuarios.forEach((u, index) => {
                    const idLimpia = u.userId;
                    const numero = idLimpia.split('@')[0];
                    
                    // Iconos de posición
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

                // Enviamos el mensaje al grupo con las menciones activas
                return client.sendMessage(grupoId, textoTop, { mentions });

            } catch (err) {
                console.error("ERROR EN BALTOP:", err);
                return message.reply("⚠️ No se pudo cargar el ranking en este momento.");
            }
        }
        break;

// --------- ?duel ---------

//------------------------------------------------DUEL (INICIAR RETO)--------------------------------------------------------
        case 'duel':
		case 'retar':
		case 'duelo': {
            if (!message.isGroup) return message.reply("❌ Solo funciona en grupos.");
            if (duelosActivos[grupoId]) return message.reply("⚠️ Ya hay un duelo pendiente en este grupo.");
            if (!targetId) return message.reply("❌ Debes mencionar a alguien para retarlo.");
            if (targetId === userId) return message.reply("🤡 No puedes pelear contra tu sombra.");

            const timeoutAceptacion = setTimeout(() => {
                if (duelosActivos[grupoId]) {
                    delete duelosActivos[grupoId];
                    client.sendMessage(grupoId, "◔ El duelo expiró por falta de respuesta.");
                }
            }, 5 * 60 * 1000);

            duelosActivos[grupoId] = {
                jugador1: userId,
                jugador2: targetId,
                picks: {},
                aceptado: false,
                timeoutAceptacion
            };

            const num = targetId.split("@")[0];
            return message.reply(`⚔️ *¡RETADOR APARECE!*\n\n@${num}, escribe *${prefix}accept* para aceptar el duelo.\n⌛ Tienes 5 minutos.`, { mentions: [targetId] });
        }
        break;

        //------------------------------------------------ACCEPT (ACEPTAR RETO)--------------------------------------------------------
        case 'accept':
		case 'acceptduel': {
            const duelo = duelosActivos[grupoId];
            if (!duelo) return message.reply("❌ No hay ningún duelo pendiente aquí.");
            if (userId !== duelo.jugador2) return message.reply("🤷‍♂️ No eres el jugador retado.");

            clearTimeout(duelo.timeoutAceptacion);
            duelo.aceptado = true;

            duelo.timeoutPick = setTimeout(() => {
                if (duelosActivos[grupoId]) {
                    delete duelosActivos[grupoId];
                    client.sendMessage(grupoId, "⏱️ Tiempo agotado para elegir personajes.");
                }
            }, 5 * 60 * 1000);

            return message.reply(`⇎ *DUELO ACEPTADO*\n\nAmbos preparen a sus equipos (1 a 3 personajes).\nUso: *${prefix}pick nombre1, nombre2, nombre3*`);
        }
        break;

        //------------------------------------------------PICK (ELECCIÓN Y COMBATE)--------------------------------------------------------
        case 'pick': {
            const duelo = duelosActivos[grupoId];
            if (!duelo || !duelo.aceptado) return;
            if (userId !== duelo.jugador1 && userId !== duelo.jugador2) return;

            const nombres = args.join(" ").split(",").map(n => n.trim().toLowerCase());
            if (nombres.length < 1 || nombres.length > 3) {
                return message.reply("❌ Elige de 1 a 3 personajes separados por comas.");
            }

            let equipo = [];
            let valorTotal = 0;
            let tieneADeadpool = false;

            // Procesar personajes del harem del usuario en MongoDB
            for (let nombre of nombres) {
                const p = user.harem.find(char => char.nombre.toLowerCase() === nombre);
                if (!p) return message.reply(`❌ No tienes a '${nombre}' en tu harem.`);
                if (equipo.find(e => e.nombre === p.nombre)) return message.reply(`❌ No puedes repetir a ${p.nombre}.`);

                // --- Lógica de Stamina ---
                if (p.nombre === 'Deadpool') {
                    tieneADeadpool = true;
                    p.stamina = 100; // DP nunca se cansa
                } else {
                    if ((p.stamina || 0) <= 10) return message.reply(`😫 *${p.nombre}* está exhausto (${p.stamina}%).`);
                    p.stamina = Math.max(0, (p.stamina || 0) - 30);
                }

                // Cálculo de poder: Valor Base * 1.20^Nivel
                let poderBase = Number(p.valor) * Math.pow(1.20, (p.level - 1));

                // Bonus aleatorio de Deadpool
                if (p.nombre === 'Deadpool' && Math.random() < 0.20) {
                    poderBase *= 5;
                    message.reply("🔴 *DEADPOOL:* ¡Hackeando las stats del bot! 💥");
                }

                valorTotal += poderBase;
                equipo.push(p);
            }

            duelo.picks[userId] = { equipo, valorTotal, userObj: user };
            message.reply(tieneADeadpool ? "✅ Equipo listo. 🔴 *DP:* ¡Que empiece la pachanga! 🌮" : "✅ Equipo seleccionado.");

            // --- RESOLUCIÓN CUANDO AMBOS ESTÁN LISTOS ---
            if (duelo.picks[duelo.jugador1] && duelo.picks[duelo.jugador2]) {
                clearTimeout(duelo.timeoutPick);
                
                const p1 = duelo.picks[duelo.jugador1];
                const p2 = duelo.picks[duelo.jugador2];

                // Factor suerte (±5%)
                let final1 = p1.valorTotal * (0.95 + Math.random() * 0.1);
                let final2 = p2.valorTotal * (0.95 + Math.random() * 0.1);

                // Deus Ex Machina de Deadpool (10% de ganar automáticamente)
                if (p1.equipo.some(e => e.nombre === 'Deadpool') && Math.random() < 0.10) {
                    final1 += final2;
                    message.reply("🔴 *DEADPOOL:* ¡Victoria por puro guionazo! Soy el mejor.");
                } else if (p2.equipo.some(e => e.nombre === 'Deadpool') && Math.random() < 0.10) {
                    final2 += final1;
                    message.reply("🔴 *DEADPOOL:* ¡Puse explosivos en sus números! Victoria por conveniencia.");
                }

                const ganadorId = final1 > final2 ? duelo.jugador1 : duelo.jugador2;
                const perdedorId = final1 > final2 ? duelo.jugador2 : duelo.jugador1;
                const winData = duelo.picks[ganadorId];
                const loseData = duelo.picks[perdedorId];

                // Economía: Robo del 15%
                const robo = Math.floor(loseData.userObj.dinero * 0.15);
                loseData.userObj.dinero -= robo;
                winData.userObj.dinero += robo;

                // Reparto de XP y Evolución
                [p1, p2].forEach(pData => {
                    const esGanador = pData.userObj.userId === ganadorId;
                    const xpBase = esGanador ? 60 : 20;

                    pData.equipo.forEach(p => {
                        p.exp += xpBase;
                        while (p.exp >= (p.level || 1) * 100) {
                            p.exp -= (p.level || 1) * 100;
                            p.level += 1;
                            
                            // Check de Evolución inmediata
                            const ref = personajes.find(pj => pj.nombre.toLowerCase() === p.nombre.toLowerCase());
                            if (ref && ref.evolucion && p.level >= ref.nivelEvo) {
                                const evo = personajes.find(pj => pj.nombre.toLowerCase() === ref.evolucion.toLowerCase());
                                if (evo) {
                                    p.nombre = evo.nombre;
                                    p.imagen = evo.imagen;
                                    p.valor = evo.valor;
                                    client.sendMessage(grupoId, `✨ ¡*${evo.nombre}* ha evolucionado tras el combate!`);
                                }
                            }
                        }
                    });
                });

                // Guardar ambos usuarios en MongoDB
                await p1.userObj.save();
                await p2.userObj.save();

                let res = `『 ⚔️ *RESULTADO DEL DUELO* 』\n\n`;
                res += `👤 @${duelo.jugador1.split('@')[0]}: ${Math.floor(final1).toLocaleString()}\n`;
                res += `👤 @${duelo.jugador2.split('@')[0]}: ${Math.floor(final2).toLocaleString()}\n\n`;
                res += `🏆 *GANADOR:* @${ganadorId.split('@')[0]}\n💰 Recompensa: *$${robo.toLocaleString()}*`;

                client.sendMessage(grupoId, res, { mentions: [duelo.jugador1, duelo.jugador2] });
                delete duelosActivos[grupoId];
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
            
            return message.reply(msg);
        }
        break;

        //------------------------------------------------CREADOR (ORIGEN)--------------------------------------------------------
        case 'creador': {
            return message.reply('🧠 Fui creado por una mente esquizofrenica: *Jack*.');
        }
        break;

        //------------------------------------------------NUMERO (AZAR)--------------------------------------------------------
        case 'numero': {
            const num = Math.floor(Math.random() * 100) + 1;
            return message.reply(`🎲 Tu número random es: *${num}*`);
        }
        break;

//------------------------------------------------RW (ROLL CHARACTER)--------------------------------------------------------
    case 'rw':
	case 'roll':
	case 'tirar':
	case 'pj': {
            // 1. Bloqueo Anti-Spam (Evita el bug de múltiples mensajes)
            if (procesandoRW.has(chatId)) return;
            procesandoRW.add(chatId);

            try {
                const ahora = Date.now();
                const totalRW = 15 * 60 * 1000;

                // 2. Verificación de Cooldown Persistente (DB)
                if (ahora - (user.lastRW || 0) < totalRW) {
                    const restante = totalRW - (ahora - user.lastRW);
                    return message.reply(`◔ Espera *${msToTime(restante)}* para sacar a otro personaje.`);
                }

                // 3. Lógica de Pesos (Probabilidades)
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

                // 4. Verificar si ya existe en el grupo (Cualquier usuario del grupo en DB)
                const yaReclamado = await User.findOne({ 
                    "harem.nombre": personajeSeleccionado.nombre,
                    "harem.grupoId": grupoId // Asumiendo que guardamos el grupoId en el objeto del harem
                });
                
                let estado = yaReclamado ? "Ya fue reclamado en este grupo" : "Libre";

                // 5. Preparar Media
                const response = await fetch(personajeSeleccionado.imagen);
                const buffer = Buffer.from(await response.arrayBuffer());
                const media = new MessageMedia('image/jpeg', buffer.toString('base64'), 'personaje.jpg');

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
                    `◇ Tienes 1 minuto para reclamar con *${prefix}c*`;

                const sentMsg = await client.sendMessage(grupoId, media, { caption: msgTexto });

                // 6. Guardar tirada en Memoria (Temporal para el claim)
                tiradasTemporales[sentMsg.id._serialized] = {
                    personaje: personajeSeleccionado,
                    grupoId: grupoId,
                    reclamado: false
                };

                // Actualizar cooldown en DB
                user.lastRW = ahora;
                await user.save();

                // Expiración de la tirada
                setTimeout(() => {
                    delete tiradasTemporales[sentMsg.id._serialized];
                }, 60000);

            } catch (error) {
                console.error('Error en RW:', error);
                message.reply('⚠️ No pude cargar la imagen, pero sigo vivo (creo).');
            } finally {
                procesandoRW.delete(chatId);
            }
        }
        break;

        //------------------------------------------------C (CLAIM / RECLAMAR)--------------------------------------------------------
		case 'c':
		case 'claim':
		case 'reclamar': {
            if (!message.hasQuotedMsg) {
                return message.reply('⌦ Debes responder al mensaje del personaje para reclamarlo.');
            }

            const quoted = await message.getQuotedMessage();
            const tirada = tiradasTemporales[quoted.id._serialized];

            if (!tirada || tirada.reclamado || tirada.grupoId !== grupoId) {
                return message.reply('⌦ Ese personaje ya expiró, fue reclamado o no es de este grupo.');
            }

            const ahora = Date.now();
            const totalC = 20 * 60 * 1000;

            // Verificación de Cooldown Persistente (DB)
            if (ahora - (user.lastClaim || 0) < totalC) {
                const restante = totalC - (ahora - user.lastClaim);
                return message.reply(`◔ Espera *${msToTime(restante)}* para reclamar otro personaje.`);
            }

            // Verificar en DB si alguien más lo ganó mientras tirabas el comando
            const dueñoExistente = await User.findOne({ 
                "harem.nombre": tirada.personaje.nombre,
                "harem.grupoId": grupoId 
            });

            if (dueñoExistente) {
                return message.reply('⌦ Demasiado tarde, alguien más ya posee este personaje en el grupo.');
            }

            // RECLAMAR
            const nuevoPersonaje = {
                ...tirada.personaje,
                level: 1,
                exp: 0,
                stamina: 100,
                grupoId: grupoId, // Marcamos a qué grupo pertenece esta instancia
                lastUpdate: ahora
            };

            user.harem.push(nuevoPersonaje);
            user.lastClaim = ahora;
            tirada.reclamado = true;

            await user.save();
            return message.reply(`꧁¡Reclamaste a ${tirada.personaje.nombre}!꧂`);
        }
        break;

//------------------------------------------------HAREM (COLECCIÓN)--------------------------------------------------------
        case 'harem':
        case 'coleccion': {
            // 1. Identificar dueño (mención, respuesta o tú mismo)
            const idUsuarioHarem = targetId || userId;
            
            // Buscamos al usuario en la DB
            const dueño = (idUsuarioHarem === userId) ? user : await User.findOne({ userId: idUsuarioHarem });

            if (!dueño || !dueño.harem || dueño.harem.length === 0) {
                const mensajeVacio = idUsuarioHarem === userId ? '❒ Tu harem está vacío.' : '❒ Este usuario no tiene personajes.';
                return message.reply(mensajeVacio);
            }

            // 2. Nombre del dueño
            const contacto = await client.getContactById(idUsuarioHarem);
            const nombreTitulo = (contacto.pushname || "Usuario").toUpperCase();

            // 3. Manejo de páginas
            let pIndex = (message.mentionedIds.length > 0 || message.hasQuotedMsg) ? 1 : 0;
            let pagina = parseInt(args[pIndex]) || 1;
            const personajesPorPagina = 20;

            // 4. Ordenar por Valor Real (Poder actual)
            let listaOrdenada = [...dueño.harem];
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
            respuesta += `         ᴘᴀ́ɢɪɴᴀ ${pagina} ᴅᴇ ${totalPaginas}\n\n`;

            personajesPagina.forEach((p, index) => {
                const valBase = Number(p.valor) || 0;
                const lvl = p.level || 1;
                const valorReal = Math.floor(valBase * Math.pow(1.20, lvl - 1));
                let numGlobal = (inicio + index + 1).toString().padStart(2, '0');
                
                if (p.nombre === 'Deadpool') {
                    respuesta += `⌁ ${numGlobal} ⌁ 🔴 *DEADPOOL*\n`;
                    respuesta += `    ╰┈─ ➤ Marvel ✦ (Valor Insuperable)\n\n`;
                } else {
                    respuesta += `⌁ ${numGlobal} ⌁ ${p.nombre} (Lvl ${lvl})\n`;
                    respuesta += `    ╰┈─ ➤ ${p.fuente} ✦ ${valorReal.toLocaleString()}\n\n`;
                }
            });

            respuesta += `━━━━━━━━━━━━━━━━━━━━\n`;
            respuesta += `⌬ Total: ${listaOrdenada.length} ⌁ Paginas: ${totalPaginas}\n`;
            respuesta += `⌬ Usa: ${prefix}harem [número] o ${prefix}harem @user`;

            return message.reply(respuesta);
        }
        break;

        //------------------------------------------------WIMAGE (BUSCAR IMAGEN)--------------------------------------------------------
        case 'wimage':
        case 'pjimg':
        case 'verpj': {
            const nombreBusqueda = args.join(" ").toLowerCase().trim();
            if (!nombreBusqueda) return message.reply(`❌ Uso: \`${prefix}wimage [nombre]\``);

            // Buscamos en la lista global de personajes cargada en memoria
            const pj = personajes.find(p => 
                p.nombre.toLowerCase() === nombreBusqueda || 
                p.nombre.toLowerCase().startsWith(nombreBusqueda)
            );

            if (!pj) return message.reply(`❌ No encontré a "${nombreBusqueda}" en la base de datos.`);

            try {
                const media = await MessageMedia.fromUrl(pj.imagen).catch(() => null);
                const caption = `『 *PERSONAJE ENCONTRADO* 』\n\n👤 *Nombre:* ${pj.nombre}\n📺 *Fuente:* ${pj.fuente}`;

                if (media) {
                    return client.sendMessage(message.from, media, { caption });
                } else {
                    return message.reply(`${caption}\n\n⚠️ _No se pudo cargar la imagen._`);
                }
            } catch (err) {
                return message.reply("⚠️ Error al procesar la imagen.");
            }
        }
        break;

        //------------------------------------------------CHARINFO (DETALLES)--------------------------------------------------------
        case 'charinfo':
        case 'infopj':
        case 'pjstats': {
            const nombreBusqueda = args.join(" ").toLowerCase().trim();
            if (!nombreBusqueda) return message.reply("❌ Escribe el nombre del personaje.");

            // Búsqueda priorizada en el harem del usuario (ya cargado en 'user')
            let pj = user.harem.find(p => p.nombre.toLowerCase() === nombreBusqueda) ||
                     user.harem.find(p => p.nombre.toLowerCase().startsWith(nombreBusqueda)) ||
                     user.harem.find(p => p.nombre.toLowerCase().includes(nombreBusqueda));

            if (!pj) return message.reply(`❌ No tienes a "${nombreBusqueda}" en tu colección.`);

            const lvl = Number(pj.level) || 1;
            const exp = Number(pj.exp) || 0;
            const stamina = pj.stamina !== undefined ? pj.stamina : 100;
            const xpSiguienteNivel = lvl * 100;
            const poderReal = Math.floor(Number(pj.valor) * Math.pow(1.20, (lvl - 1)));

            let infoMsg = `『 👤 *DETALLES DEL PERSONAJE* 』\n`;
            infoMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
            infoMsg += `⭐ *Nombre:* ${pj.nombre}\n`;
            infoMsg += `🎬 *Serie:* ${pj.fuente}\n`;
            infoMsg += `📊 *Nivel:* ${lvl}\n`;
            infoMsg += `✨ *XP:* ${exp} / ${xpSiguienteNivel}\n`;
            infoMsg += `⚔️ *Poder Real:* ${poderReal.toLocaleString()}\n`;
            infoMsg += `⚡ *Energía:* ${stamina}%\n\n`;
            infoMsg += `━━━━━━━━━━━━━━━━━━━━`;

            try {
                // Usamos fetch/buffer para mayor estabilidad con MessageMedia
                const response = await fetch(pj.imagen);
                const buffer = Buffer.from(await response.arrayBuffer());
                const media = new MessageMedia('image/jpeg', buffer.toString('base64'), 'char.jpg');
                return client.sendMessage(message.from, media, { caption: infoMsg });
            } catch (error) {
                return message.reply(infoMsg);
            }
        }
        break;


//------------------------------------------------DICE (APUESTAS)--------------------------------------------------------
        case 'dice':
        case 'dado':
        case 'apostar': {
            const apuesta = parseInt(args[0]);

            if (isNaN(apuesta) || apuesta <= 0) {
                return message.reply(`❏ *Uso:* ${prefix}dice [cantidad]`);
            }

            // Verificamos el dinero del usuario (ya cargado en 'user' desde Mongo)
            if (user.dinero < apuesta) {
                return message.reply("❏ *Error:* No tienes suficiente dinero para esta apuesta.");
            }

            // Tu lógica: 1-3 Pierde, 4-6 Gana
            const resultado = Math.floor(Math.random() * 6) + 1;
            let msgDice = `『  *DADOS* 』\n\n↳ Sacaste: [ ${resultado} ]\n`;

            if (resultado >= 4) {
                user.dinero += apuesta;
                msgDice += `↳ *RESULTADO:* Ganaste $${apuesta.toLocaleString()}\n`;
            } else {
                user.dinero -= apuesta;
                msgDice += `↳ *RESULTADO:* Perdiste $${apuesta.toLocaleString()}\n`;
            }

            msgDice += `↳ *SALDO ACTUAL:* $${user.dinero.toLocaleString()}`;
            
            // Guardamos en MongoDB
            await user.save();
            return message.reply(msgDice);
        }
        break;

        //------------------------------------------------SHIP (AMOR AL AZAR)--------------------------------------------------------
        case 'ship':
        case 'pareja':
        case 'shippear':
        case 'testearamor': {
            const chat = await message.getChat();
            if (!chat.isGroup) return message.reply("Este comando solo funciona en grupos.");

            const participantes = chat.participants;
            if (participantes.length < 2) return message.reply("No hay suficientes personas para un ship.");

            // Seleccionar dos personas al azar
            const p1 = participantes[Math.floor(Math.random() * participantes.length)];
            let p2 = participantes[Math.floor(Math.random() * participantes.length)];

            // Evitar que se shipee consigo mismo
            while (p2.id._serialized === p1.id._serialized) {
                p2 = participantes[Math.floor(Math.random() * participantes.length)];
            }

            // Obtener contactos para los nombres
            const contacto1 = await client.getContactById(p1.id._serialized);
            const contacto2 = await client.getContactById(p2.id._serialized);

            const nombre1 = contacto1.pushname || p1.id.user;
            const nombre2 = contacto2.pushname || p2.id.user;

            const porcentaje = Math.floor(Math.random() * 101);
            let comentario = "";

            if (porcentaje < 20) comentario = "💔 Destinados al fracaso... 💔";
            else if (porcentaje < 50) comentario = "♡ Hay una chispa, pero falta trabajo. ♡";
            else if (porcentaje < 80) comentario = "♥ ¡Hacen una pareja increíble! ♥";
            else comentario = "ლ ¡AMOR VERDADERO! Boda pronto. ლ";

            let textoShip = `ღ *SHIP TESTER* ღ\n\n`;
            textoShip += `*${nombre1}* +  *${nombre2}*\n`;
            textoShip += `◈ *Resultado:* ${porcentaje}%\n\n`;
            textoShip += `> ${comentario}`;

            // Enviamos el mensaje mencionando a ambos
            return client.sendMessage(message.from, textoShip, {
                mentions: [p1.id._serialized, p2.id._serialized]
            });
        }
        break;


//------------------------------------------------GIVECHAR (REGALAR)--------------------------------------------------------
        case 'givechar':
        case 'regalar':
        case 'darpersonaje':
        case 'obsequiar': {
            if (!message.from.endsWith("@g.us")) return message.reply("❌ Solo en grupos.");
            
            // 1. Validar receptor (Mención o Respuesta)
            if (!targetId) return message.reply("❌ Menciona a alguien o responde a su mensaje.");
            if (targetId === userId) return message.reply("❌ No puedes regalarte algo a ti mismo, gracioso.");

            // 2. Limpiar el nombre del personaje de los argumentos
            // Quitamos la mención (números) para quedarnos solo con el nombre del PJ
            const nombrePJ = args.join(" ").replace(/@\d+\s*/g, "").trim().toLowerCase();
            if (!nombrePJ) return message.reply(`❌ Uso: ${prefix}givechar @usuario Nombre`);

            // 3. Buscar al receptor en la DB
            const receptor = await User.findOne({ userId: targetId });
            if (!receptor) return message.reply("❌ El usuario no está registrado en mi base de datos.");

            // 4. Buscar el personaje en tu harem (ya cargado en 'user')
            const index = user.harem.findIndex(p => p.nombre.toLowerCase() === nombrePJ);

            if (index === -1) {
                return message.reply(`❌ No tienes a "${nombrePJ}" en tu colección de este grupo.`);
            }

            // --- OPERACIÓN DE TRASPASO ---
            // Sacamos el personaje de tu harem
            const [personaje] = user.harem.splice(index, 1);
            
            // Lo añadimos al harem del receptor
            // Mantenemos el mismo objeto (con su nivel, xp, etc.)
            receptor.harem.push(personaje);

            // 5. Guardar ambos cambios en MongoDB
            await user.save();
            await receptor.save();

            return client.sendMessage(message.from, 
                `🎁 *¡REGALO EXITOSO!*\n\n` +
                `*${personaje.nombre}* ha sido transferido.\n` +
                `Ahora le pertenece a: @${targetId.split('@')[0]}`,
                { mentions: [targetId] }
            );
        }
        break;

	
//------------------------------------------------TR (TRADUCTOR)--------------------------------------------------------
        case 'tr':
        case 'traducir':
        case 'traductor':
        case 'traduccion': {
            // Extraemos el texto después del comando y sus alias
            const text = args.join(" ").trim();
            
            if (!text) {
                return message.reply(`❌ Escribe lo que quieres traducir.\nEjemplo: \`${prefix}tr hello world\``);
            }

            try {
                // Usamos la API de Google Translate (vía gtx)
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text)}`;
                const res = await axios.get(url);
                
                // La respuesta de esta API es un array un poco loco, así se extrae el texto limpio:
                const translation = res.data[0].map(item => item[0]).join('');
                const detectedLang = res.data[2]; // El código del idioma detectado (en, jp, fr, etc.)

                let msgTr = `『 🔠 *TRADUCCIÓN* 』\n`;
                msgTr += `━━━━━━━━━━━━━━━━━━━━\n`;
                msgTr += `🌐 *Origen:* ${detectedLang.toUpperCase()} ➔ *Destino:* ES\n\n`;
                msgTr += `${translation}\n`;
                msgTr += `━━━━━━━━━━━━━━━━━━━━`;

                return message.reply(msgTr);

            } catch (e) {
                console.error("Error en Traductor:", e.message);
                return message.reply("⚠️ No pude conectar con el servicio de traducción. Inténtalo más tarde.");
            }
        }
        break;

//------------------------------------------------TRADE (PROPONER)--------------------------------------------------------
        case 'trade':
        case 'intercambio':
        case 'truque':
        case 'cambiar': {
            if (!message.from.endsWith("@g.us")) return message.reply("❌ Solo en grupos.");
            
            // 1. Limpieza de trades antiguos o duplicados
            if (tradesPendientes[grupoId]) return message.reply("⚠️ Ya hay un intercambio pendiente en este grupo. Espera a que termine o expire (60s).");

            // 2. Validar receptor
            if (!targetId || targetId === userId) return message.reply("❌ Menciona a alguien o responde su mensaje para proponer un intercambio.");

            // 3. Procesar argumentos (Mi PJ | Su PJ)
            const textoTrade = args.join(" ").replace(/@\d+\s*/g, "");
            const partes = textoTrade.split("|");

            if (partes.length !== 2) return message.reply(`❌ Uso: \`${prefix}trade @usuario Mi PJ | Su PJ\``);

            const miNombreBusqueda = partes[0].trim().toLowerCase();
            const suNombreBusqueda = partes[1].trim().toLowerCase();

            // 4. Buscar receptor en DB
            const receptorDoc = await User.findOne({ userId: targetId });
            if (!receptorDoc) return message.reply("❌ El usuario receptor no está registrado.");

            // 5. Verificar personajes en los harems (user ya está cargado, receptorDoc lo acabamos de traer)
            const miPJ = user.harem.find(p => p.nombre.toLowerCase() === miNombreBusqueda);
            const suPJ = receptorDoc.harem.find(p => p.nombre.toLowerCase() === suNombreBusqueda);

            if (!miPJ) return message.reply(`❌ No tienes a "${miNombreBusqueda}" en tu colección.`);
            if (!suPJ) return message.reply(`❌ Esa persona no tiene a "${suNombreBusqueda}" en su colección.`);

            // 6. Guardar propuesta en memoria temporal (RAM)
            tradesPendientes[grupoId] = {
                iniciador: userId,
                receptor: targetId,
                nombrePJIniciador: miPJ.nombre, 
                nombrePJReceptor: suPJ.nombre,
                timeout: setTimeout(() => { 
                    if (tradesPendientes[grupoId]) {
                        delete tradesPendientes[grupoId];
                    }
                }, 60000)
            };

            return client.sendMessage(message.from, 
                `🔄 *PROPUESTA DE INTERCAMBIO*\n\n` +
                `👤 @${userId.split('@')[0]} ofrece: *${miPJ.nombre}*\n` +
                `👤 @${targetId.split('@')[0]} ofrece: *${suPJ.nombre}*\n\n` +
                `✅ @${targetId.split('@')[0]}, escribe *${prefix}aceptartrade* para confirmar.`,
                { mentions: [userId, targetId] }
            );
        }
        break;

        //------------------------------------------------ACEPTAR TRADE--------------------------------------------------------
        case 'aceptartrade':
        case 'confirmartrade':
        case 'aceptarcambio': {
            const trade = tradesPendientes[grupoId];
            if (!trade) return message.reply("❌ No hay intercambios pendientes en este grupo o ya expiró.");

            if (userId !== trade.receptor) {
                return message.reply("❌ Solo la persona que recibió la oferta puede aceptar el intercambio.");
            }

            // Traemos al iniciador de la DB (el receptor ya es 'user')
            const iniciadorDoc = await User.findOne({ userId: trade.iniciador });
            if (!iniciadorDoc) return message.reply("❌ Error: No se encontró al proponente original.");

            // Buscamos los índices exactos para el intercambio
            const idxIniciador = iniciadorDoc.harem.findIndex(p => p.nombre === trade.nombrePJIniciador);
            const idxReceptor = user.harem.findIndex(p => p.nombre === trade.nombrePJReceptor);

            // Verificación de seguridad final
            if (idxIniciador === -1 || idxReceptor === -1) {
                clearTimeout(trade.timeout);
                delete tradesPendientes[grupoId];
                return message.reply("❌ El intercambio falló: uno de los personajes ya no está con su dueño original.");
            }

            try {
                // --- OPERACIÓN MAESTRA DE INTERCAMBIO ---
                const [pjDelIniciador] = iniciadorDoc.harem.splice(idxIniciador, 1);
                const [pjDelReceptor] = user.harem.splice(idxReceptor, 1);

                // Cruzamos los dueños
                iniciadorDoc.harem.push(pjDelReceptor);
                user.harem.push(pjDelIniciador);

                // Guardar ambos en MongoDB
                await iniciadorDoc.save();
                await user.save();

                clearTimeout(trade.timeout);
                delete tradesPendientes[grupoId];

                return client.sendMessage(message.from, 
                    `🤝 *¡INTERCAMBIO COMPLETADO!*\n\n` +
                    `✅ *${pjDelIniciador.nombre}* ➔ @${trade.receptor.split('@')[0]}\n` +
                    `✅ *${pjDelReceptor.nombre}* ➔ @${trade.iniciador.split('@')[0]}`,
                    { mentions: [trade.iniciador, trade.receptor] }
                );

            } catch (err) {
                console.error("Error crítico en trade:", err);
                return message.reply("⚠️ Error de base de datos al procesar el intercambio.");
            }
        }
        break;
	
// ============ COMANDO ?wtired ================
if (message.body.startsWith(prefix + 'wtired')) {
    if (!haremPorGrupo[grupoId] || !haremPorGrupo[grupoId][userId] || haremPorGrupo[grupoId][userId].length === 0) {
        return message.reply('❒ Tu harem está vacío.');
    }

    // 1. Extraer página
    const args = message.body.slice((prefix + 'wtired').length).trim().split(/\s+/);
    let pagina = parseInt(args[0]) || 1;
    const personajesPorPagina = 20;

    // 2. Actualizar stamina de todos y clonar
    let listaStats = haremPorGrupo[grupoId][userId].map(p => {
        return actualizarStamina(p); 
    });

    // 3. Ordenar (opcional: aquí los ordeno por los más cansados primero)
    listaStats.sort((a, b) => (a.stamina || 0) - (b.stamina || 0));

    // 4. Cálculos de página
    const totalPaginas = Math.ceil(listaStats.length / personajesPorPagina);
    if (pagina < 1) pagina = 1;
    if (pagina > totalPaginas) pagina = totalPaginas;

    const inicio = (pagina - 1) * personajesPorPagina;
    const fin = inicio + personajesPorPagina;
    const personajesPagina = listaStats.slice(inicio, fin);

    // 5. Construir mensaje con estilo minimalista
    let respuesta = `༺ ESTADO DE ENERGÍA ༻\n`;
    respuesta += `━━━━━━━━━━━━━━━━━━━━\n`;
    respuesta += `          ᴘᴀ́ɢɪɴᴀ ${pagina} ᴅᴇ ${totalPaginas}\n\n`;

    personajesPagina.forEach((p, index) => {
        let numGlobal = (inicio + index + 1).toString().padStart(2, '0');
        
        // Indicador visual sin emojis (usando caracteres de barra)
        let barra = p.stamina <= 10 ? 'ᛃ [!!!!!!!!!]' : (p.stamina < 50 ? 'ᛃ [#####----]' : 'ᛃ [+++++++++]');

        respuesta += `⌁ ${numGlobal} ⌁ ${p.nombre}\n`;
        respuesta += `    ╰┈─ ➤ ⚡ ${p.stamina}% ${barra}\n\n`;
    });

    respuesta += `━━━━━━━━━━━━━━━━━━━━\n`;
    respuesta += `⌬ Total: ${listaStats.length} ⌁ Usa ?wtired [n]`;

    return message.reply(respuesta);
}

//============= COMANDO ?smob (VERSIÓN FINAL COMPLETA) ===============
if (comando === 'smob') {
    const ahora = Date.now();
    const tiempoEspera = 15 * 60 * 1000; // 15 minutos entre búsquedas
    const grupoId = message.from;
    const userId = message.author || message.from;

    // --- SISTEMA DE COOLDOWN ---
    if (!cooldownsBuscarmob[grupoId]) cooldownsBuscarmob[grupoId] = {};
    if (cooldownsBuscarmob[grupoId][userId] && ahora - cooldownsBuscarmob[grupoId][userId] < tiempoEspera) {
        const restante = Math.ceil((tiempoEspera - (ahora - cooldownsBuscarmob[grupoId][userId])) / 1000 / 60);
        return message.reply(`⏳ Tus rastreadores están cargando. Espera **${restante} min** para buscar otro mob.`);
    }

    const mobTemplate = mobsData[Math.floor(Math.random() * mobsData.length)];
    const hData = cargarHarem();
    const misPersonajes = hData[grupoId]?.[userId] || [];
    
    // --- LÓGICA DE PODER CONTROLADA ---
    let poderBase = Math.floor(Math.random() * (30000 - 10000 + 1)) + 10000;
    let bonoNivel = 0;

    if (misPersonajes.length > 0) {
        // Promedio de los 3 mejores (solo si no son nivel bugueado)
        const mejores = misPersonajes
            .sort((a, b) => (b.level || 1) - (a.level || 1))
            .slice(0, 3);
        
        const nivelPromedio = mejores.reduce((sum, p) => sum + (Number(p.level) || 1), 0) / mejores.length;
        
        // Cada nivel promedio añade 1,500 de poder (Lineal, no exponencial)
        bonoNivel = nivelPromedio * 1500;
    }

    let poderMob = Math.floor(poderBase + bonoNivel);

    // 🔥 ESCUDO ANTI-INFINITO (MÁXIMO 500k)
    if (poderMob > 500000 || !isFinite(poderMob)) {
        poderMob = 500000; 
    }

    // Guardar mob en memoria del grupo
    mobActual[grupoId] = {
        nombre: mobTemplate.nombre,
        poderTotal: poderMob,
        vencido: false,
        creadoEn: ahora // Para que expire en 7 mins
    };

    cooldownsBuscarmob[grupoId][userId] = ahora;

    message.reply(`👾 ¡Detección de Poder! Ha aparecido: *${mobTemplate.nombre}*\n💪 Nivel de Poder: *${poderMob.toLocaleString()}*\n\n>Tienes **7 minutos** para pelear antes de que escape.`);
}

	
//============= COMANDO ?fight (CORREGIDO) ===============
if (comando === 'fight') {
    const grupoId = message.from;
    const userId = message.author || message.from;

    if (!mobActual[grupoId] || mobActual[grupoId].vencido) {
        return message.reply("❌ No hay mobs en esta zona. Usa *?smob* para buscar uno.");
    }

    const ahora = Date.now();
    if (ahora - mobActual[grupoId].creadoEn > 7 * 60 * 1000) {
        delete mobActual[grupoId];
        return message.reply("⏰ El mob se ha escapado...");
    }

    const nombresPjs = message.body.slice(prefix.length + 5).split(',').map(n => n.trim().toLowerCase());
    if (nombresPjs.length === 0 || !nombresPjs[0]) return message.reply("❌ Uso: *?fight pj1, pj2...*");

    // Usamos directamente haremPorGrupo que ya está en la memoria RAM
const userHarem = haremPorGrupo[grupoId]?.[userId] || [];

    let equipo = [];

    for (let nombrePj of nombresPjs) {
        let pj = userHarem.find(p => p.nombre.toLowerCase() === nombrePj);
        if (pj) {
            actualizarStamina(pj);
            if ((pj.stamina || 0) < 15) return message.reply(`😫 *${pj.nombre}* está agotado (${pj.stamina}%).`);
            if (!equipo.find(e => e.nombre === pj.nombre)) equipo.push(pj);
        }
    }

    if (equipo.length === 0) return message.reply("❌ Esos personajes no están en tu harem.");

    const mob = mobActual[grupoId];

    // CÁLCULO DE PODER REAL (Usa tus valores de harem con niveles)
    let poderTuEquipo = equipo.reduce((sum, p) => {
        const nivel = Number(p.level) || 1;
        const valorBase = Number(p.valor) || 0;
        return sum + (valorBase * Math.pow(1.20, nivel - 1));
    }, 0);

    poderTuEquipo *= (0.95 + Math.random() * 0.15);

    message.reply(`⚔️ *BATALLA EN CURSO* ⚔️\n\n🛡️ Poder Equipo: *${Math.floor(poderTuEquipo).toLocaleString()}*\n👾 Poder Enemigo: *${mob.poderTotal.toLocaleString()}*`);

    setTimeout(() => {
		// --- DENTRO DE LA VICTORIA ---
if (poderTuEquipo >= mob.poderTotal) {
    const gananciaDinero = Math.floor(Math.random() * 10001) + 5000;
    const xpGanada = Math.floor(mob.poderTotal / 200); 

    // USA LA RAM (Instantáneo)
    asegurarUsuario(carteras, userId);
    carteras[userId].dinero = (Number(carteras[userId].dinero) || 0) + gananciaDinero;
    
    // SOLO AVISA AL RELOJ
    economiaSucia = true; 

    let avisosNivel = "";
    for (let p of equipo) { // Usamos for para manejar mejor la evolución
        p.exp = (Number(p.exp) || 0) + xpGanada;
        p.stamina = Math.max(0, p.stamina - 15);

        let nivelesSubidos = 0;
        while (p.exp >= (Number(p.level) || 1) * 100) {
            p.exp -= (Number(p.level) || 1) * 100;
            p.level = (Number(p.level) || 1) + 1;
            nivelesSubidos++;
        }

        if (nivelesSubidos > 0) {
            avisosNivel += `\n🆙 *${p.nombre}* subió al nivel *${p.level}*!`;

            // ✅ NUEVA LÓGICA DE EVOLUCIÓN
            if (p.nivelEvo && p.level >= p.nivelEvo) {
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

    // SOLO AVISA AL RELOJ
    haremSucio = true; 
    mobActual[grupoId].vencido = true;
        
         message.reply(`✅ *¡VICTORIA!* 🎉\n\n💰 Dinero: *$${gananciaDinero.toLocaleString()}*\n✨ XP: *+${xpGanada}*${avisosNivel}`);
        } else {
            message.reply(`💀 *DERROTA...* El mob era muy fuerte.`);
        }
    }, 2000);
}

	

// --------- COMANDO ADMIN: INVOCAR DEADPOOL ---------
    if (comando === 'spawndeadpool') {
        const miIDPropio = '232246195839008@lid'; 
        
        if (userId !== miIDPropio) {
            return message.reply("🔴 *DEADPOOL:* EY! deja ahí! JAMÁS ME ATRAPARÁS, YO SOY EL JESÚS DE MARVEL!.");
        }

        const mencionado = message.mentionedIds[0] || (message.body.split(' ')[1] ? message.body.split(' ')[1] + '@c.us' : null);
        
        if (!mencionado) {
            return message.reply("🔴 *DEADPOOL:* Ahhhh, el admin abusando de sus poderes mimimimimi.");
        }

        // Limpiar multiverso
        for (let g in haremPorGrupo) {
            for (let u in haremPorGrupo[g]) {
                haremPorGrupo[g][u] = haremPorGrupo[g][u].filter(p => p.nombre !== 'Deadpool');
            }
        }

        if (!haremPorGrupo[grupoId]) haremPorGrupo[grupoId] = {};
        if (!haremPorGrupo[grupoId][mencionado]) haremPorGrupo[grupoId][mencionado] = [];

        // Tus diálogos integrados
        const frasesDeadpool = [
            "¡Hola! El harem anterior olía a calzones usados, así que me mudé aquí. ¿Qué hay de comer?",
            "Ahora soy un inmigrante ilegal en tu harem, por lo menos hasta que el fokin BOT se crashee... otra vez!",
            "¿Vieron eso? Acabo de saltar de un usuario a otro ignorando por completo todas las reglas del código del YakBot. ¡Soy genial!",
            "Hey, HEY! Tú... el de la pantalla. Sí sí, acabo de entrar en tu harem. No te acostumbres, me aburro rápido, como una mujer siendole fiel a un hombre.",
            "El programador intentó ponerme un precio, pero soy invaluable (y muy sexy en mis mallas)."
        ];
        
        const fraseElegida = frasesDeadpool[Math.floor(Math.random() * frasesDeadpool.length)];

        const deadpoolObj = {
            nombre: "Deadpool",
            fuente: "Marvel",
            valor: 696969,
            imagen: "https://i.pinimg.com/736x/dd/91/76/dd9176fa6d3699a754a8ae5c3d518b32.jpg",
            level: 102,
            stamina: 100,
            exp: 0
        };

        haremPorGrupo[grupoId][mencionado].push(deadpoolObj);
        guardarHarem(haremPorGrupo);

        const targetClean = mencionado.split('@')[0];
        return client.sendMessage(message.from, `🔴 *DEADPOOL:* ${fraseElegida}\n\n_¡Deadpool ha invadido el harem de @${targetClean}!_`, { mentions: [mencionado] });
    }

	// ============= RESETEAR NIVELES (LÍMITE 1,000) =============
if (comando === 'fixlevels') {
    const adminID = '232246195839008@lid'; 
    if (userId !== adminID) return;

    const hData = cargarHarem();
    let cont = 0;

    for (let g in hData) {
        for (let u in hData[g]) {
            hData[g][u].forEach(p => {
                let lvl = Number(p.level);
                // Si el nivel es mayor a 1,000 o es Infinito/NaN
                if (lvl > 1000 || !isFinite(lvl) || isNaN(lvl)) {
                    p.level = 1;
                    p.exp = 0;
                    cont++;
                }
            });
        }
    }

    guardarHarem(hData);
    message.reply(`✨ *PURIFICACIÓN COMPLETADA* ✨\n\nSe han reseteado **${cont}** personajes que superaban el nivel 1,000.\n\n*(Tu Admin Char y personajes legales no han sido afectados)*.`);
}

// --- COMANDO PARA DAR DINERO (SOLO ADMIN) ---
if (message.body.startsWith(prefix + 'addmoney')) {
    const adminID = '232246195839008@lid'; 
    if (userId !== adminID) return message.reply("⚠️ No tienes permiso.");

    const parts = message.body.split(/\s+/); 
    let cantidad = parseInt(parts[1]); 

    if (isNaN(cantidad)) return message.reply("❌ Uso: `?addmoney [cantidad] [@usuario]`");

    // --- LÓGICA DE DESTINATARIO ---
    let targetId = userId; // Por defecto, tú mismo

    // Si hay una mención en el mensaje, usamos el ID del mencionado
    if (message.mentionedIds && message.mentionedIds.length > 0) {
        targetId = message.mentionedIds[0];
    }
    // 1. Usamos la variable GLOBAL 'carteras'
    asegurarUsuario(carteras, targetId); 
    // 2. Sumamos directamente en la RAM
    carteras[targetId].dinero = (Number(carteras[targetId].dinero) || 0) + cantidad;
    // 3. Avisamos al reloj de guardado
    economiaSucia = true;
    // 4. Preparamos el mensaje según a quién se lo diste
    const totalActual = carteras[targetId].dinero;
    const nombreDestino = targetId === userId ? "tu cuenta" : `@${targetId.split('@')[0]}`;
    const menciones = targetId === userId ? [] : [targetId];

    if (typeof darLogro === 'function' && darLogro(perfiles, targetId, "admin_money")) {
        perfilesSucios = true;
        client.sendMessage(message.from, `🏆 *LOGRO:* Generosidad del Admin\n💰 Se han añadido *$${cantidad.toLocaleString()}* a ${nombreDestino}.\n✨ Saldo: *$${totalActual.toLocaleString()}*`, { mentions: menciones });
    } else {
        client.sendMessage(message.from, `✅ Dinero enviado.\n💰 Cantidad: *$${cantidad.toLocaleString()}*\n👤 Destino: ${nombreDestino}\n✨ Nuevo Saldo: *$${totalActual.toLocaleString()}*`, { mentions: menciones });
    }
}

// ============= COMANDO ADMIN: DELCHAR (SOLO NÚMEROS) =============
if (comando === 'delchar') {
    // 1. SEGURIDAD: Solo el Admin puede usar esto
    const adminID = '232246195839008@lid'; // Tu ID de Admin
    if (userId !== adminID) return message.reply("⚠️ No tienes permisos para borrar personajes.");

    // 2. IDENTIFICAR VÍCTIMA (Mención o Respuesta)
    if (!targetId) return message.reply("❌ Uso: `?delchar [Nombre] @usuario` o responde a su mensaje.");

    // 3. LIMPIAR NOMBRE DEL PERSONAJE
    const nombrePJ = args.join(" ").replace(/@\d+\s*/g, "").trim().toLowerCase();
    if (!nombrePJ) return message.reply("❌ Debes especificar el nombre del personaje.");

    const victimaId = targetId;

    // 4. VALIDACIONES EN RAM
    if (!haremPorGrupo[grupoId]?.[victimaId] || haremPorGrupo[grupoId][victimaId].length === 0) {
        return message.reply("❌ Esa persona no tiene personajes en su harem.");
    }

    const haremVictima = haremPorGrupo[grupoId][victimaId];
    
    // Buscamos ignorando mayúsculas/minúsculas
    const index = haremVictima.findIndex(p => p.nombre.toLowerCase() === nombrePJ);

    if (index === -1) {
        return message.reply(`❌ No se encontró a "${nombrePJ}" en el harem de ese usuario.`);
    }

    // 5. EJECUCIÓN (BORRADO EN RAM)
    const [eliminado] = haremVictima.splice(index, 1);

    // ACTIVAR BANDERA PARA EL RELOJ DE GUARDADO
    haremSucio = true;

    return client.sendMessage(
        message.from,
        `🗑️ *PERSONAJE ELIMINADO*\n\nEl personaje *${eliminado.nombre}* ha sido borrado para siempre del harem de @${victimaId.split('@')[0]}.`,
        { mentions: [victimaId] }
    );
}
	
// --------- COMANDO ?kick ---------
if (comando === 'kick') {

    const chat = await message.getChat();

    if (!chat.isGroup) {
        return message.reply("Este comando solo funciona en grupos.");
    }

    const sender = await message.getContact();
    const botId = client.info.wid._serialized;

    const senderParticipant = chat.participants.find(p =>
        p.id._serialized === sender.id._serialized
    );

    const botParticipant = chat.participants.find(p =>
        p.id._serialized === botId
    );

    // verificar admin
    if (!senderParticipant?.isAdmin && !senderParticipant?.isSuperAdmin) {
        return message.reply("❌ Solo los administradores pueden usar este comando.");
    }

    // verificar bot admin
    if (!botParticipant?.isAdmin && !botParticipant?.isSuperAdmin) {
        return message.reply("Necesito ser admin para expulsar a un miembro del grupo");
    }

    let objetivo;

    // ✅ menciones reales
    const mentions = await message.getMentions();

    if (mentions.length > 0) {
        objetivo = mentions[0].id._serialized;
    }

    // ✅ responder mensaje
    else if (message.hasQuotedMsg) {

    const quoted = await message.getQuotedMessage();
    const contact = await quoted.getContact();

    objetivo = contact.id._serialized;

	}

    if (!objetivo) {
        return message.reply("Debes mencionar al usuario o responder a su mensaje.");
    }

    // buscar participante
    const target = chat.participants.find(p =>
        p.id._serialized === objetivo
    );

    if (!target) {
        return message.reply("❌ No encontré a ese usuario en el grupo.");
    }

    // evitar expulsar bot
    if (target.id._serialized === botId) {
        return message.reply("❌ No puedo expulsarme a mí mismo.");
    }

    // evitar expulsar admins
    if (target.isAdmin || target.isSuperAdmin) {
        return message.reply("❌ No puedes expulsar a otro administrador.");
    }

    try {

        const contacto = await client.getContactById(target.id._serialized);
        const nombre = contacto.pushname || contacto.name || contacto.number;

        await chat.removeParticipants([target.id._serialized]);

        await chat.sendMessage(`"${nombre}" ha sido expulsado del grupo`);

    } catch (err) {

        console.log("Error kick:", err);
        message.reply("No pude expulsar a ese usuario.");
    }
}

	
// --------- ?adminchar (SOLO ADMIN) ---------

if (comando === 'adminchar') {
    const adminNumber = "232246195839008@lid"; 

    if (userId !== adminNumber) {
        return message.reply("❌ ERROR: Acceso denegado.");
    }

    if (!haremPorGrupo[grupoId]) haremPorGrupo[grupoId] = {};
    if (!haremPorGrupo[grupoId][userId]) haremPorGrupo[grupoId][userId] = [];

    const yaLoTiene = haremPorGrupo[grupoId][userId].find(p => p.nombre === "♛ PERSONAJE DEL ADMIN ♛");
    if (yaLoTiene) return message.reply("Ya posees el poder absoluto.");

    const adminChar = {
        nombre: "EL ADMIN",
        fuente: "SISTEMA",
        valor: 9999999999999999999999999999,
        imagen: "https://i.pinimg.com/736x/22/1a/da/221ada2b52d13dcc65999b2cda540aae.jpg", 
        genero: "Divino",
        level: 100,
        exp: 0,
        stamina: 1000,
        lastUpdate: Date.now()
    };

    try {
        // Intentamos descargar la imagen para confirmar que funciona antes de guardarlo
        const response = await fetch(adminChar.imagen);
        if (!response.ok) throw new Error("Error al descargar");
        
        const buffer = Buffer.from(await response.arrayBuffer());
        const media = new MessageMedia('image/jpeg', buffer.toString('base64'), 'admin.jpg');

        haremPorGrupo[grupoId][userId].push(adminChar);
        guardarHarem(haremPorGrupo);

        await message.reply(media, undefined, { 
            caption: "⚡ *EL PODER ABSOLUTO HA SIDO RECLAMADO* ⚡\n\nBienvenido, Creador." 
        });

    } catch (error) {
        console.log('Error en adminchar:', error.message);
        // Si la imagen falla, igual te damos el personaje pero con un aviso
        haremPorGrupo[grupoId][userId].push(adminChar);
        guardarHarem(haremPorGrupo);
        return message.reply("⚡ Personaje reclamado, pero la imagen falló. Puedes ver sus stats con ?charinfo.");
    }
}

// --------- ?s (sticker imagen / gif / video) ---------

if (message.body === '?s' || 
   (message.hasMedia && message.caption === '?s')) {

    let mediaMsg;

    if (message.hasQuotedMsg) {
        const quoted = await message.getQuotedMessage();
        if (!quoted.hasMedia) {
            return message.reply("Responde a una imagen, gif o video.");
        }
        mediaMsg = quoted;
    }
    else if (message.hasMedia) {
        mediaMsg = message;
    }
    else {
        return message.reply("Envía o responde a una imagen, gif o video con ?s");
    }

    try {
        const media = await mediaMsg.downloadMedia();

        // 🔥 Detectar tipo
        if (media.mimetype.includes("image")) {

            // Sticker normal
            await message.reply(media, undefined, {
                sendMediaAsSticker: true,
                stickerAuthor: "YakBot",
                stickerName: "YakBot tm"
            });

        } else if (media.mimetype.includes("video") || media.mimetype.includes("gif")) {

            // Verificar duración si es video
if (mediaMsg._data.seconds && mediaMsg._data.seconds > 10) {
    return message.reply("El video debe durar máximo 10 segundos.");
}

if (media.filesize && media.filesize > 8 * 1024 * 1024) {
    return message.reply("El archivo es demasiado pesado.");
}

            await message.reply(media, undefined, {
                sendMediaAsSticker: true,
                stickerAuthor: "YakBot",
                stickerName: "YakBot tm"
            });

        } else {
            return message.reply("Formato no soportado.");
        }

    } catch (err) {
        console.log(err);
        message.reply("Error al crear el sticker.");
    }
}

// ==========================================
    // REACCIONES ANIME (MP4 CONVERTIDO - MODO GIF)
    // ==========================================
const listaReacciones = ['cry', 'sad', 'happy', 'angry', 'pat', 'preg', 'laugh', 'dance', 'scared', 'eat', 'sleep', 'cafe', 'hug', 'punch', 'kill', 'run', 'kiss'];
const comandoLimpio = comando.split(/\s+/)[0];

if (listaReacciones.includes(comandoLimpio)) {
    
    // 1. Lógica de Logros y RAM
    perfiles[userId].reacciones = (perfiles[userId].reacciones || 0) + 1;
    perfilesSucios = true; // Usamos el reloj en lugar de guardarPerfiles()

    const metas = { "react_40": 40, "react_100": 100, "react_200": 200, "react_500": 500 };
    for (let slug in metas) {
        if (perfiles[userId].reacciones >= metas[slug]) {
            if (darLogro(perfiles, userId, slug)) {
                message.reply(`🏆 Logro desbloqueado: Hacer ${metas[slug]} reacciones de anime`);
            }
        }
    }

    // 2. Preparación de nombres y menciones (USANDO targetId que definimos arriba)
    const authorContact = await message.getContact();
    const authorName = authorContact.pushname || 'Usuario';
    
    let nombreMencionado = "";
    if (targetId) {
        const contactMencionado = await client.getContactById(targetId);
        // Si es mencionado, sacamos su nombre para la frase
        nombreMencionado = `*${contactMencionado.pushname || contactMencionado.number.split('@')[0]}*`;
    }

    const frases = {
        cry: { solo: `*${authorName}* se puso a llorar... `, con: `*${authorName}* está llorando por culpa de ${nombreMencionado}` },
        sad: { solo: `*${authorName}* está triste...`, con: `*${authorName}* se siente triste por ${nombreMencionado}` },
        happy: { solo: `*${authorName}* está muy feliz!`, con: `*${authorName}* sonríe junto a ${nombreMencionado}` },
        angry: { solo: `*${authorName}* está de mal humor`, con: `*${authorName}* está enojado por culpa de ${nombreMencionado}` },
        laugh: { solo: `*${authorName}* se está riendo a carcajadas`, con: `*${authorName}* se ríe con ${nombreMencionado}` },
        dance: { solo: `*${authorName}* se sacó los pasos prohibídos`, con: `*${authorName}* está bailando con ${nombreMencionado}` },
        scared: { solo: `*${authorName}* tiene mucho miedo 😱`, con: `*${authorName}* se asustó con ${nombreMencionado} 😱` },
        eat: { solo: `*${authorName}* está comiendo algo delicioso`, con: `*${authorName}* come junto a ${nombreMencionado} algo muy delicioso` },
        sleep: { solo: `*${authorName}* se quedó dormido... 💤`, con: `*${authorName}* duerme junto a ${nombreMencionado} 💤` },
        cafe: { solo: `*${authorName}* toma cafe caliente`, con: `*${authorName}* está tomando café con ${nombreMencionado}` },
        hug: { solo: `*${authorName}* dio un abrazo al aire... 🤗`, con: `*${authorName}* le dio un gran abrazo a ${nombreMencionado} 🤗` },
        kiss: { solo: `*${authorName}* lanzó un beso al aire... 💋`, con: `*${authorName}* le dio un beso a ${nombreMencionado} 💋` },
        punch: { solo: `*${authorName}* soltó un golpe al aire `, con: `*${authorName}* golpeó con todas sus fuerzas a ${nombreMencionado}` },
        run: { solo: `*${authorName}* salió corriendo lejos de aquí... `, con: `*${authorName}* está huyendo de ${nombreMencionado}` },
        kill: { solo: `*${authorName}* se mató a sí mismo... `, con: `*${authorName}* mató sin piedad a ${nombreMencionado}` },
        pat: { solo: `*${authorName}* se da palmadas en la cabeza a sí mismo`, con: `*${authorName}* le da palmadas en la cabeza a ${nombreMencionado} con cariño` },
        preg: { solo: `*${authorName}* se embarazó solito... misterioso... `, con: `*${authorName}* embarazó a ${nombreMencionado} y ahora deben pensar en nombres` }
    };

    // Elegimos la frase según si existe un objetivo (por mención o respuesta)
    let textoFinal = targetId ? frases[comandoLimpio].con : frases[comandoLimpio].solo;

    // 3. Selección de GIF y proceso FFMPEG
    const rawGifPath = animeGifs[comandoLimpio][Math.floor(Math.random() * animeGifs[comandoLimpio].length)];
    const gifPath = path.join(__dirname, rawGifPath);
    const outputPath = `./temp_${Date.now()}.mp4`; 

    ffmpeg(gifPath)
        .setFfmpegPath(ffmpegPath)
        .outputOptions(['-pix_fmt yuv420p', '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'])
        .toFormat('mp4')
        .on('end', async () => {
            try {
                const media = MessageMedia.fromFilePath(outputPath);
                await client.sendMessage(message.from, media, {
                    caption: textoFinal,
                    sendVideoAsGif: true,
                    mentions: targetId ? [targetId] : [] // Menciona al objetivo real
                });
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (e) { console.log("Error enviando reacción:", e); }
        })
        .on('error', (err) => {
            console.log("Error FFMPEG:", err);
            message.reply("❌ Error al procesar el GIF.");
        })
        .save(outputPath);

    return;
}

// --- DETECTOR DE COMANDO INEXISTENTE ---
    if (message.body.startsWith(prefix)) {
        const comandoBase = comando.split(/\s+/)[0];
        const misComandos = ['duel', 'rw', 'harem', 'wimage', 'aceptartrade', 'shop', 'gay', 'kick', 'delcahr', 'fixlevels', 'bal', 'baltop', 'buy', 'crime', 'daily', 'c', 'help', 'menu', 'cal', 'ping', 'charinfo', 'charlist', 'profile', 'logros', 'pay', 'cooldowns', 'w', 'pokevo', 'accept', 'pick', 's', 'say', 'tr', 'dice', 'smob', 'fight', 'reload', 'addmoney', 'charshop', 'bchar', 'givechar'];
        
        if (!misComandos.includes(comandoBase) && !listaReacciones.includes(comandoBase)) {
            return message.reply(`⌦ El comando *${prefix}${comandoBase}* no existe.\n Usa *${prefix}help* para ver la lista de comandos`);
        }
    }

}); // CIERRE FINAL DE message_create (client.on)

// --------- INICIALIZAR ---------
client.initialize();

setInterval(() => {
    console.log("YakBot sigue vivo:", new Date().toLocaleTimeString());
}, 60000);

})().catch(err => console.error("❌ Error crítico al iniciar:", err));
// FIN DEL ARCHIVO

// Reloj de guardado inteligente (Cada 5 minutos)
setInterval(() => {
    if (perfilesSucios) {
        fs.writeFileSync('./data/perfiles.json', JSON.stringify(perfiles, null, 2));
        perfilesSucios = false;
        console.log("💾 Perfiles guardados.");
    }
    if (haremSucio) {
        fs.writeFileSync('./data/harem.json', JSON.stringify(haremPorGrupo, null, 2));
        haremSucio = false;
        console.log("💾 Harem guardado.");
    }
    if (economiaSucia) { // <--- AÑADE ESTO
        fs.writeFileSync('./data/economia.json', JSON.stringify(carteras, null, 2));
        economiaSucia = false;
        console.log("💾 Economía guardada.");
    }
}, 300000);



