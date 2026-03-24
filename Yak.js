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

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const qrcode = require('qrcode-terminal');
const dataFolder = './data/';
const fs = require('fs');

const haremFile = './harem.json';
const economiaFile = './economia.json';
const perfilesFile = './data/perfiles.json';

function cargarHarem() {
    const path = dataFolder + 'harem.json';
    if (fs.existsSync(path)) return JSON.parse(fs.readFileSync(path, 'utf-8'));
    return {};
}
function cargarEconomia() {
    const path = dataFolder + 'economia.json';
    try {
        if (fs.existsSync(path)) {
            return JSON.parse(fs.readFileSync(path, 'utf-8'));
        }
    } catch (error) {
        console.log("Error leyendo economía, creando una nueva...");
    }
    return {}; // Si no existe, devuelve carteras vacías
}
function cargarPerfiles() {
    if (!fs.existsSync(perfilesFile)) {
        fs.writeFileSync(perfilesFile, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(perfilesFile));
}

let perfilesSucios = false;
let haremSucio = false;
let economiaSucia = false;

let perfiles = cargarPerfiles();
let haremPorGrupo = cargarHarem();
let carteras = cargarEconomia();

const sharp = require('sharp');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const play = require('play-dl');
const { exec } = require('child_process');
const axios = require('axios');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const http = require('http');

// Crear un servidor básico para que Railway no apague el bot
http.createServer((req, res) => {
  res.write('YakBot está vivo');
  res.end();
}).listen(process.env.PORT || 3000, () => {
  console.log(`Servidor de salud escuchando en el puerto ${process.env.PORT || 3000}`);
});

// ==========================================
//        ANTI-CRASH GLOBAL (REPARADO)
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
    console.error(' [ANTI-CRASH] Rechazo no manejado en:', promise, 'razón:', reason);
});

process.on('uncaughtException', (err, origin) => {
    console.error(' [ANTI-CRASH] Excepción no capturada:', err);
    console.error(' [ANTI-CRASH] Origen:', origin);
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
    console.error(' [ANTI-CRASH] Monitor de excepción:', err);
});
// ==========================================
	

(async () => {



let botSettings = {};
if (fs.existsSync('./botSettings.json')) {
    botSettings = JSON.parse(fs.readFileSync('./botSettings.json'));
}

const animeGifs = {
    cry: [
        './gifs/cry1.gif',
        './gifs/cry2.gif',
        './gifs/cry3.gif',
        './gifs/cry4.gif',
        './gifs/cry5.gif'
    ],
    happy: [
        './gifs/happy1.gif',
        './gifs/happy2.gif',
        './gifs/happy3.gif'
    ],
    angry: [
        './gifs/angry1.gif',
        './gifs/angry2.gif',
        './gifs/angry3.gif'
    ],
    laugh: [
        './gifs/laugh1.gif',
        './gifs/laugh2.gif',
        './gifs/laugh3.gif'
    ],
    hug: [
        './gifs/hug1.gif',
        './gifs/hug2.gif',
        './gifs/hug3.gif'
    ],
    dance: [
        './gifs/dance1.gif',
        './gifs/dance2.gif',
        './gifs/dance3.gif'
    ],
        cafe: [
        './gifs/cafe1.gif',
        './gifs/cafe2.gif',
        './gifs/cafe3.gif'
    ],
    kiss: [
        './gifs/kiss1.gif',
        './gifs/kiss2.gif',
        './gifs/kiss3.gif',
        './gifs/kiss4.gif'
    ],
    sad: [
        './gifs/sad1.gif',
        './gifs/sad2.gif',
        './gifs/sad3.gif',
        './gifs/sad4.gif'
    ],
    eat: [
        './gifs/eat1.gif',
        './gifs/eat2.gif',
        './gifs/eat3.gif',
        './gifs/eat4.gif'
    ],
    sleep: [
        './gifs/sleep1.gif',
        './gifs/sleep2.gif',
        './gifs/sleep3.gif',
        './gifs/sleep4.gif'
    ],
    scared: [
        './gifs/scared1.gif',
        './gifs/scared2.gif',
        './gifs/scared3.gif',
        './gifs/scared4.gif'
    ],
	punch: [
        './gifs/punch1.gif',
        './gifs/punch2.gif',
        './gifs/punch3.gif',
        './gifs/punch4.gif'
    ],
	run: [
        './gifs/run1.gif',
        './gifs/run2.gif',
        './gifs/run3.gif',
        './gifs/run4.gif'
    ],
	kill: [
        './gifs/kill1.gif',
        './gifs/kill2.gif',
        './gifs/kill3.gif',
        './gifs/kill4.gif'
    ],
	preg: [
        './gifs/Preg1.gif',
        './gifs/Preg2.gif',
        './gifs/Preg3.gif',
        './gifs/Preg4.gif',
		'./gifs/Preg5.gif',
		'./gifs/Preg6.gif'
    ],
	pat: [
        './gifs/Pat1.gif',
        './gifs/Pat2.gif',
        './gifs/Pat3.gif',
        './gifs/Pat4.gif',
		'./gifs/Pat5.gif'
    ]
};

// Variable para los cooldowns en memoria (se reinicia al apagar el bot)
let cooldownsBuscarmob = {}; 

// Variable para guardar el mob que aparece en cada grupo
let mobActual = {};
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

const procesandoRW = new Set(); 

function msToTime(ms) {
    const minutos = Math.floor(ms / 60000);
    const segundos = Math.floor((ms % 60000) / 1000);
    return `${minutos}m ${segundos}s`;
}

function guardarHarem(data) {
    haremPorGrupo = data; 
    haremSucio = true; // Solo marcamos que hubo un cambio
}

const duelosActivos = {};
const tradesPendientes = {};


function guardarEconomia(data) {
    // En lugar de escribir el archivo aquí, solo avisamos al reloj
    carteras = data; // Asegúrate de que la variable coincida con la que usas
    economiaSucia = true; 
}

function sleep(ms){
    return new Promise(r => setTimeout(r, ms));
}

async function esperar() {
    await sleep(1000);
}

esperar();

function asegurarUsuario(data, userId) {
    if (!data[userId]) {
        data[userId] = {
            dinero: 0,
            lastDaily: null,
            lastWork: 0,
            lastCrime: 0
        };
    }
}

function actualizarStamina(personaje) {
    // Si por alguna razón el personaje no tiene nivel o stamina (personajes viejos)
    if (personaje.level === undefined) personaje.level = 1;
    if (personaje.stamina === undefined) personaje.stamina = 100;
    if (personaje.lastUpdate === undefined) personaje.lastUpdate = Date.now();

    const ahora = Date.now();
    const tiempoPasado = ahora - personaje.lastUpdate;
    
    // Recupera 10% cada 30 minutos (1800000 ms)
    const porcionRecuperada = Math.floor(tiempoPasado / 1800000) * 10;
    
    if (porcionRecuperada > 0) {
        personaje.stamina = Math.min(100, personaje.stamina + porcionRecuperada);
        personaje.lastUpdate = ahora; 
    }
    return personaje;
}


// Cliente
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './data/session'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--single-process',
            '--disable-accelerated-2d-canvas', // Nueva
            '--disable-gpu',                   // Nueva
            '--no-first-run'                   // Nueva
        ],
    }
});


client.on('code', (code) => {
    console.log('\n Código para vincularte a Yak-bot:');
    console.log(code);
    console.log('Ve a WhatsApp > Dispositivos vinculados > Vincular con número');
});


// Mostrar QR
client.on('qr', (qr) => {
    // 1. Lo seguimos intentando en consola por si acaso
    qrcode.generate(qr, { small: true });

    // 2. LA SOLUCIÓN: Genera un link para que lo veas en el navegador
    console.log("--------------------------------------------------");
    console.log("SI EL QR DE ARRIBA SE VE MAL, ESCANEA ESTE:");
    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
    console.log("--------------------------------------------------");
});

// Bot listo
client.on('ready', () => {
    console.log('✅ YakBot listo y conectado');
	
// LIMPIEZA DE CACHÉ
    const cacheDir = './.wwebjs_cache';
    if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
        console.log('🗑️ Caché de WhatsApp Web limpia para ahorrar espacio.');
    }
// Ejecutar limpieza de personajes antiguos al encender
    haremPorGrupo = cargarHarem(); // Recargamos por si acaso
    limpiarHaremNaN(haremPorGrupo);
});

		client.on("change_state", state => {
    console.log("Estado:", state);
});


// ---------------- VARIABLES GLOBALES ----------------
const personajes = JSON.parse(
  fs.readFileSync("./personajes.json", "utf8")
)
	
// --- FUNCIÓN PARA LIMPIAR PERSONAJES ANTIGUOS (Añadir debajo de guardarHarem) ---
function limpiarHaremNaN(data) {
    let corregidos = 0;
    for (let grupoId in data) {
        for (let userId in data[grupoId]) {
            data[grupoId][userId].forEach(p => {
                // Si el nivel no existe, es NaN o menor a 1, lo reseteamos
                if (p.level === undefined || isNaN(p.level) || p.level < 1) {
                    p.level = 1;
                    corregidos++;
                }
                // Si la XP no existe o es NaN, la reseteamos
                if (p.exp === undefined || isNaN(p.exp)) {
                    p.exp = 0;
                }
                // Aseguramos stamina también
                if (p.stamina === undefined || isNaN(p.stamina)) {
                    p.stamina = 100;
                }
            });
        }
    }
    if (corregidos > 0) {
        console.log(`🧹 Se arreglaron ${corregidos} personajes con stats rotos (NaN).`);
        guardarHarem(data); // Guardamos los cambios permanentemente
    }
}

// --- SISTEMA DE CHARSHOP POR GRUPO (PRECIOS AJUSTADOS) ---
let charShopsPorGrupo = {}; 

function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60);
    let minutes = Math.floor((duration / (1000 * 60)) % 60);
    return `${minutes}m ${seconds}s`;
}

function actualizarCharShop(grupoId, forzar = false) {
    const ahora = Date.now();
    const tiempoRotacion = 3000000; 

    if (forzar || !charShopsPorGrupo[grupoId] || (ahora - charShopsPorGrupo[grupoId].ultimaActualizacion >= tiempoRotacion)) {
        const nuevosPersonajes = [];
        const nombresEnHarem = [];
        if (haremPorGrupo[grupoId]) {
            Object.values(haremPorGrupo[grupoId]).forEach(userHarem => {
                userHarem.forEach(p => nombresEnHarem.push(p.nombre.toLowerCase()));
            });
        }
        const disponibles = personajes.filter(p => !nombresEnHarem.includes(p.nombre.toLowerCase()));
        const copiaDisponibles = [...disponibles];

        for (let i = 0; i < 5; i++) {
            if (copiaDisponibles.length === 0) break;
            const indexAleatorio = Math.floor(Math.random() * copiaDisponibles.length);
            const pBase = copiaDisponibles.splice(indexAleatorio, 1)[0];
            const valorBase = parseInt(pBase.valor) || 0;
            let precioFinal;

            // --- PRECIOS BAJADOS ---
            if (valorBase >= 17000) {
                precioFinal = 700000 + Math.floor(Math.random() * 300001); // 700k - 1M
            } else if (valorBase >= 5000) {
                precioFinal = 250000 + Math.floor(Math.random() * 250000); // 250k - 500k
            } else {
                precioFinal = 15000 + Math.floor((valorBase / 5000) * 200000); // 15k - 215k
            }

            nuevosPersonajes.push({ ...pBase, precio: precioFinal });
        }
        charShopsPorGrupo[grupoId] = { personajes: nuevosPersonajes, ultimaActualizacion: ahora };
    }
}

const tiradasTemporales = {};
const cooldownsRW = {};
const cooldownsC = {};
let haremPorGrupo = cargarHarem();

// Tirada ponderada (CORREGIDA)
function personajeRandom(listaPersonajes) {
    // Primero filtramos a Deadpool para que no salga en rolls
    const filtrados = listaPersonajes.filter(p => p.nombre !== 'Deadpool');
    
    const total = filtrados.reduce((sum, p) => sum + (100000 - Number(p.valor)), 0);
    let rnd = Math.random() * total;

    for (let p of filtrados) {
        rnd -= (100000 - Number(p.valor));
        if (rnd <= 0) return p;
    }
    return filtrados[filtrados.length - 1];
}

function guardarPerfiles(data) {
    perfilesSucios = true; // Solo marcamos que hubo un cambio
}

function asegurarPerfil(perfiles, userId) {
    if (!perfiles[userId]) {
        
		perfiles[userId] = {
    xp: 0,
    level: 1,
    mensajes: 0,
    comandos: 0,
    reacciones: 0,
    logros: []
};
    }
}
function darLogro(perfiles, userId, logro) {

    if (!perfiles[userId].logros.includes(logro)) {

        perfiles[userId].logros.push(logro);

        return true;
    }

    return false;
}
	const logrosInfo = {

cmd_1: "Usar un comando por primera vez",

cmd_500: "Usar 500 comandos",
cmd_1000: "Usar 1,000 comandos",
cmd_10000: "Usar 10,000 comandos",
cmd_50000: "Usar 50,000 comandos",

chars_15: "Conseguir 15 personajes",
chars_30: "Conseguir 30 personajes",
chars_50: "Conseguir 50 personajes",
chars_100: "Conseguir 100 personajes",

money_100k: "Tener 100,000 de dinero",
money_1m: "Tener 1,000,000 de dinero",
money_10m: "Tener 10,000,000 de dinero",
money_100m: "Tener 100,000,000 de dinero",

duel_admin: "Derrotar al admin en un duel",

react_40: "Hacer 40 reacciones de anime",
react_100: "Hacer 100 reacciones de anime",
react_200: "Hacer 200 reacciones de anime",
react_500: "Hacer 500 reacciones de anime",

three_am: "Usar un comando a las 3 AM",

admin_money: "Conseguir que el admin te de dinero",

completionist: "Conseguir todos los logros"

};
	
// ---------------- MENSAJES ----------------

const prefix = '?';

client.on('message_create', async (message) => {

    if (message.fromMe) return;

    console.log("Mensaje:", message.body);

    if (!message.body.startsWith(prefix)) return; 

    const args = message.body.slice(prefix.length).trim().split(/ +/);
    const comando = args.shift().toLowerCase();
    console.log("Comando detectado:", comando);
    const texto = message.body.toLowerCase().trim();
    if (!texto.startsWith(prefix)) return;

    // --- AQUÍ PEGAS ESTO (JUSTO DESPUÉS DE LAS DEFINICIONES) ---
    let targetId = null;

    if (message.mentionedIds && message.mentionedIds.length > 0) {
        targetId = message.mentionedIds[0];
    } 
    else if (message.hasQuotedMsg) {
        // Obtenemos el mensaje al que estás respondiendo
        const quotedMsg = await message.getQuotedMessage(); 
        // Sacamos el ID de la persona que escribió ese mensaje
        targetId = quotedMsg.author || quotedMsg.from;
    }
	const pushname = message._data.notifyName || "Usuario";
	
    const chatId = message.from;
if (message.isGroup) {
    if (!botSettings[chatId]) {
        botSettings[chatId] = { enabled: true };
    }

const isGroup = message.from.endsWith("@g.us");

let userId;

if (isGroup) {
    userId = message.author || message._data.participant;
} else {
    userId = message.from;
}

    if (!botSettings[chatId].enabled && !message.body.toLowerCase().startsWith(`${prefix}bot on`)) {
        return; // Ignora todos los comandos si está apagado
    }
}

    const userId = message.author || message._data.participant || message.from;
    const grupoId = message.from;

    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
	const perfiles = cargarPerfiles();
asegurarPerfil(perfiles, userId);
	perfiles[userId].mensajes += 1;
perfiles[userId].xp += 2;

guardarPerfiles(perfiles);
	const xpNecesaria = perfiles[userId].level * 100;

if (perfiles[userId].xp >= xpNecesaria) {

    perfiles[userId].xp -= xpNecesaria;
    perfiles[userId].level += 1;

    message.reply(`⭐ ¡Subiste al nivel ${perfiles[userId].level}!`);
}

	perfiles[userId].comandos += 1;
	if (perfiles[userId].comandos === 1) {
    if (darLogro(perfiles, userId, "cmd_1")) {
        message.reply("🏆 Logro desbloqueado: Usar un comando por primera vez");
    }
}

if (perfiles[userId].comandos === 500) {
    if (darLogro(perfiles, userId, "cmd_500")) {
        message.reply("🏆 Logro desbloqueado: Usar 500 comandos");
    }
}

if (perfiles[userId].comandos === 1000) {
    if (darLogro(perfiles, userId, "cmd_1000")) {
        message.reply("🏆 Logro desbloqueado: Usar 1,000 comandos");
    }
}

if (perfiles[userId].comandos === 10000) {
    if (darLogro(perfiles, userId, "cmd_10000")) {
        message.reply("🏆 Logro desbloqueado: Usar 10,000 comandos");
    }
}

if (perfiles[userId].comandos === 50000) {
    if (darLogro(perfiles, userId, "cmd_50000")) {
        message.reply("🏆 Logro desbloqueado: Usar 50,000 comandos");
    }
}

	const hora = new Date().getHours();
	if (hora === 3) {

    if (darLogro(perfiles, userId, "three_am")) {

        message.reply("🏆 Logro desbloqueado: Usar un comando a las 3 AM");

    }

	}
	const economia = cargarEconomia();
	if (economia[userId]) {

    const dinero = economia[userId].dinero || 0;

if (dinero >= 100000) {
        if (darLogro(perfiles, userId, "money_100k")) {
            message.reply("🏆 Logro desbloqueado: Tener 100,000 de dinero");
        }
    }

    if (dinero >= 1000000) {
        if (darLogro(perfiles, userId, "money_1m")) {
            message.reply("🏆 Logro desbloqueado: Tener 1,000,000 de dinero");
        }
    }

    if (dinero >= 10000000) {
        if (darLogro(perfiles, userId, "money_10m")) {
            message.reply("🏆 Logro desbloqueado: Tener 10,000,000 de dinero");
        }
    }

    if (dinero >= 100000000) {
        if (darLogro(perfiles, userId, "money_100m")) {
            message.reply("🏆 Logro desbloqueado: Tener 100,000,000 de dinero");
        }
    }

	}

	const harem = cargarHarem();
	const cantidadPersonajes = harem[userId]?.length || 0;
	
    if (cantidadPersonajes >= 15) {
    if (darLogro(perfiles, userId, "chars_15")) {
        message.reply("🏆 Logro desbloqueado: Conseguir 15 personajes");
    }
}

if (cantidadPersonajes >= 30) {
    if (darLogro(perfiles, userId, "chars_30")) {
        message.reply("🏆 Logro desbloqueado: Conseguir 30 personajes");
    }
}

if (cantidadPersonajes >= 50) {
    if (darLogro(perfiles, userId, "chars_50")) {
        message.reply("🏆 Logro desbloqueado: Conseguir 50 personajes");
    }
}

if (cantidadPersonajes >= 100) {
    if (darLogro(perfiles, userId, "chars_100")) {
        message.reply("🏆 Logro desbloqueado: Conseguir 100 personajes");
    }
}
	guardarPerfiles(perfiles);
	
// --- LÓGICA DE DEADPOOL ERRANTE (LIMITADO AL GRUPO) ---
    const chanceDeadpool = Math.random();

    // 5% de probabilidad en cada mensaje de que Deadpool se mude dentro del grupo
    if (chanceDeadpool < 0.05) { 
        // 1. Obtener todos los usuarios que tienen harem EN ESTE GRUPO
        let usuariosEnEsteGrupo = Object.keys(haremPorGrupo[grupoId] || {});

        // Solo se mueve si hay más de una persona con harem en el grupo
        if (usuariosEnEsteGrupo.length > 1) {
            
            // 2. Borrar a Deadpool de todos los harems DE ESTE GRUPO únicamente
            for (let u in haremPorGrupo[grupoId]) {
                haremPorGrupo[grupoId][u] = haremPorGrupo[grupoId][u].filter(p => p.nombre !== 'Deadpool');
            }

            // 3. Elegir la nueva "víctima" (dueño) al azar dentro del mismo grupo
            let nuevoDueñoId = usuariosEnEsteGrupo[Math.floor(Math.random() * usuariosEnEsteGrupo.length)];
            
            const deadpoolObj = {
                nombre: "Deadpool",
                fuente: "Marvel",
                valor: 696969, 
                imagen: "https://i.pinimg.com/736x/dd/91/76/dd9176fa6d3699a754a8ae5c3d518b32.jpg",
                level: 102,
                stamina: 100
            };

            // 4. Meterlo en el harem del nuevo dueño
            haremPorGrupo[grupoId][nuevoDueñoId].push(deadpoolObj);
            guardarHarem(haremPorGrupo);

            const frasesDeadpool = [
                "¡Hola! El harem anterior olía a calzones usados, así que me mudé aquí. ¿Qué hay de comer?",
		"Ahora soy un inmigrante ilegal en tu harem, por lo menos hasta que el fokin BOT se crashee... otra vez!",
                "¿Vieron eso? Acabo de saltar de un usuario a otro ignorando por completo todas las reglas del código del YakBot. ¡Soy genial!",
                "Hey, HEY! Tú... el de la pantalla. Sí sí, acabo de entrar en tu harem. No te acostumbres, me aburro rápido, como una mujer siendole fiel a un hombre.",
                "El programador intentó ponerme un precio, pero soy invaluable (y muy sexy en mis mallas)."
            ];
            
            const frase = frasesDeadpool[Math.floor(Math.random() * frasesDeadpool.length)];
            const numeroLimpio = nuevoDueñoId.split('@')[0];
            
            await client.sendMessage(message.from, `🔴 *DEADPOOL:* ${frase}\n\n_¡Deadpool ha saltado al harem de @${numeroLimpio}!_`, {mentions: [nuevoDueñoId]});
        }
    }

    // --------- COMANDOS BÁSICOS ---------

    if (comando === 'hola') {
        return message.reply('Hola, soy YakBot ☽');
    }

if (comando === 'reload') {

    const ownerNumber = "232246195839008@lid";

    const isBot = message.fromMe;

    if (userId !== ownerNumber && !isBot) {
        return message.reply("ME NIEGO, no tienes permiso para usar este comando.");
    }

    await message.reply("♻ Yakbot se está recargando...");

    setTimeout(() => {
        process.exit(0);
    }, 1000);
}


if (['menu', 'help'].includes(comando)) {
            const menuText = `『 *MENÚ DE YAKBOT* 』

✦ *GACHA & RPG*

${prefix}rw
> Tira un personaje aleatorio (15 min CD).

${prefix}c
> Reclama el personaje (20 min CD).

${prefix}harem [n]
> Tu colección (ordenada por valor, 20 por página).

${prefix}wtired [n]
> Estado de energía y cansancio de tu harem.

${prefix}charinfo [Nombre]
> Stats detallados de los personajes de tu harem: Nivel, EXP y Poder Real.

${prefix}wimage [Nombre]
> Muestra la imagen de un personaje.

${prefix}charlist [Fuente]
> Lista de personajes disponibles por serie.

${prefix}givechar @usuario [Nombre]
> Regala un personaje de tu harem.

${prefix}trade @usuario [MiChar] | [SuChar]
> Intercambio de personajes.

${prefix}aceptartrade
> Aceptar un trade.

${prefix}smob
> Busca mobs para pelear contra ellos y conseguir recompensas.

${prefix}fight personaje1, personaje2, personaje3
> Pelea contra los mobs que salieron en smob.


✧ *PVP 3v3 (NIVELES)*

${prefix}duel @usuario
> Reta a alguien (5 min para aceptar).

${prefix}accept
> Acepta el duelo pendiente.

${prefix}pick [char1, char2, char3]
> Elige equipo. ¡Los niveles aumentan tu poder!


✦ *ECONOMÍA & TIENDAS*

${prefix}w
> Trabaja para ganar dinero (1 min CD).

${prefix}crime
> Intenta un crimen (5 min CD).

${prefix}daily
> Recompensa diaria (Reset 9 PM).

${prefix}bal
> Consulta tu dinero actual.

${prefix}pay [cantidad] @usuario
> Transfiere dinero a otro usuario.

${prefix}dice [cantidad]
> Apuesta tu dinero al dado.

${prefix}charshop
> Mercado rotativo de personajes nuevos.

${prefix}bchar [número]
> Compra un personaje del mercado.

${prefix}shop
> Tienda de objetos (Pociones, XP, Evolución).

${prefix}buy [número] [nombre]
> Compra y usa un objeto en un personaje.

${prefix}cooldowns
> Consulta tus tiempos de espera.


✧ *REACCIONES ANIME*

⌁ ${prefix}cry
    ╰┈─ ➤ Llorar por algo.
⌁ ${prefix}sad
    ╰┈─ ➤ Estar triste.
⌁ ${prefix}happy
    ╰┈─ ➤ Mostrar felicidad.
⌁ ${prefix}angry
    ╰┈─ ➤ Expresar enojo.
⌁ ${prefix}laugh
    ╰┈─ ➤ Reírse a carcajadas.
⌁ ${prefix}run
    ╰┈─ ➤ Salír corriendo.
⌁ ${prefix}punch @usuario
    ╰┈─ ➤ Golpear a alguien.
⌁ ${prefix}kill @usuario
    ╰┈─ ➤ Asesinar a alguien	
⌁ ${prefix}dance
    ╰┈─ ➤ Echarse unos pasos.
⌁ ${prefix}scared
    ╰┈─ ➤ ¡Qué miedo!
⌁ ${prefix}eat
    ╰┈─ ➤ Hora de la comida.
⌁ ${prefix}sleep
    ╰┈─ ➤ Irse a dormir.
⌁ ${prefix}pat
    ╰┈─ ➤ Darle cariño a alguien.
⌁ ${prefix}preg
    ╰┈─ ➤ Embarazar a alguien.
⌁ ${prefix}cafe
    ╰┈─ ➤ Tomar un cafecito.
⌁ ${prefix}hug @usuario
    ╰┈─ ➤ Dar un abrazo.
⌁ ${prefix}kiss @usuario
    ╰┈─ ➤ Dar un beso.


⊹ *DIVERSIÓN*
${prefix}gay
> Calcula qué tan gay es alguien


✦ *STICKERS*

${prefix}s
> Convierte imagen, GIF o video en sticker.


✧ *ADMIN & OTROS*

${prefix}kick
> Saca a un integrante del grupo (Solo admins).
${prefix}tr
> Traduce un texto.
${prefix}say
> Haz que el bot diga algo.
${prefix}cal
> Calculadora.

${prefix}hola | ${prefix}ping | ${prefix}info | ${prefix}creador`;

            return message.reply(menuText);
        }

// --------- COMANDO ?cal (Calculadora Universal Gboard) ---------
if (comando === 'cal') {
    const args = message.body.slice(prefix.length + 3).trim();

    if (!args) {
        return message.reply(`『 🧮 *CALCULADORA* 』\n\nUso: *${prefix}cal [operación]*\n\n*Soportados:* \n√ , π , ÷ , × , ± , % , \nExponentes: ² , ³ , ⁴ ... ⁿ\nFracciones: ½ , ¼ , ¾\n\n_Ejemplo: ${prefix}cal √64 + ½_`);
    }

    try {
        let operacion = args.toLowerCase();

        // 1. DICCIONARIO DE TRADUCCIÓN (Gboard & Unicode)
        const mapaGboard = {
            // Operadores básicos
            '×': '*', '÷': '/', '×': '*', '÷': '/', '±': '+', 
            'π': 'Math.PI', '√': 'Math.sqrt', ',': '.', ':': '/',
            // Superíndices (Exponentes de Gboard)
            '⁰': '**0', '¹': '**1', '²': '**2', '³': '**3', '⁴': '**4', 
            '⁵': '**5', '⁶': '**6', '⁷': '**7', '⁸': '**8', '⁹': '**9',
            'ⁿ': '**n', // Por si acaso
            // Fracciones comunes de Gboard
            '½': '0.5', '⅓': '(1/3)', '⅔': '(2/3)', '¼': '0.25', '¾': '0.75', 
            '⅕': '0.2', '⅖': '0.4', '⅗': '0.6', '⅘': '0.8', '⅙': '(1/6)', 
            '⅚': '(5/6)', '⅛': '0.125', '⅜': '0.375', '⅝': '0.625', '⅞': '0.875'
        };

        // 2. Aplicar traducciones
        Object.keys(mapaGboard).forEach(simbolo => {
            operacion = operacion.split(simbolo).join(mapaGboard[simbolo]);
        });

        // 3. Limpieza de caracteres comunes
        operacion = operacion
            .replace(/x/g, '*')
            .replace(/\^/g, '**')
            .replace(/%/g, '/100'); // Convierte 10% en 10/100

        // 4. Corrección de Raíz (si ponen √25 sin paréntesis)
        if (operacion.includes('Math.sqrt')) {
            // Envuelve números que siguen a Math.sqrt en paréntesis
            operacion = operacion.replace(/Math\.sqrt\s*(\d+(\.\d+)?)/g, 'Math.sqrt($1)');
        }

        // 5. SEGURIDAD: Bloqueo de código malicioso
        // Permitimos números, operadores básicos y la librería Math de JS
        const validacion = operacion.replace(/[0-9+\-*/().\s]|Math\.(sqrt|PI)/g, '');
        if (validacion.trim().length > 0) {
            return message.reply("❌ *Error:* Caracteres no permitidos detectados.");
        }

        // 6. EJECUCIÓN
        const resultado = eval(operacion);

        // Formateo de salida
        const resultadoFinal = Number.isInteger(resultado) 
            ? resultado.toLocaleString() 
            : parseFloat(resultado.toFixed(4)).toLocaleString();

        return message.reply(`『 🧮 *RESULTADO* 』\n\n✨ *Entrada:* ${args}\n✅ *Cálculo:* ${resultadoFinal}`);

    } catch (e) {
        return message.reply("❌ *Error:* Operación inválida. Revisa los signos.");
    }
}

// --------- ?gay ---------
if (comando === 'gay') {

    const mencionado = message.mentionedIds[0];
    if (!mencionado) return message.reply(`Uso: ${prefix}gay @usuario`);

    const usuario = `@${mencionado.split('@')[0]}`;

    client.sendMessage(message.from, "ꕤ Calculando nivel de gay...");

    setTimeout(() => {

        let porcentaje;

        if (Math.random() < 0.15) {
            porcentaje = Math.floor(Math.random() * 1000000000);
        } else {
            porcentaje = Math.floor(Math.random() * 100) + 1;
        }

        client.sendMessage(
            message.from,
            `🏳️‍🌈 Resultado:\n${usuario} es *${porcentaje}%* gay`,
            { mentions: [mencionado] }
        );

    }, 2500);
}

// =========== COMANDO ?profile =============
if (comando === "profile") {

    asegurarPerfil(perfiles, userId);

    const p = perfiles[userId];

    const contacto = await message.getContact();
    const chat = await message.getChat();

    const nombre = contacto.pushname || contacto.name || "Usuario";

    const xpNecesaria = p.level * 100;

    let texto = `👤 *PERFIL DE ${nombre}*\n\n`;
    texto += `⭐ Nivel: ${p.level}\n`;
    texto += `✨ XP: ${p.xp} / ${xpNecesaria}\n`;
    texto += `💬 Mensajes: ${p.mensajes}\n`;
    texto += `🏆 Logros: ${p.logros.length}\n`;

    try {

        const fotoUrl = await chat.getContact().then(c => c.getProfilePicUrl());

        if (fotoUrl) {

            const media = await MessageMedia.fromUrl(fotoUrl);

            await client.sendMessage(message.from, media, {
                caption: texto
            });

        } else {
            await message.reply(texto);
        }

    } catch (err) {
        console.log("No se pudo obtener la foto:", err);
        await message.reply(texto);
    }
}


if (comando === "logros") {

    asegurarPerfil(perfiles, userId);

    const lista = perfiles[userId].logros;

    if (lista.length === 0) {
        return message.reply("No tienes logros todavía.");
    }

    let texto = "🏆 TUS LOGROS\n\n";

    lista.forEach(l => {
        texto += `• ${logrosInfo[l] || l}\n`;
    });

    message.reply(texto);
}
	
// --------- COMANDO ?say ---------
    if (comando.startsWith('say')) {
        // Obtenemos el texto después del comando ?say
        const loQueDijo = message.body.slice(prefix.length + 3).trim();

        // Si el usuario no puso nada después de ?say
        if (!loQueDijo) {
            return message.reply("❌ Debes escribir algo para que yo lo repita. Ejemplo: *?say hola*");
        }

        // El bot envía el mensaje exacto al chat
        return client.sendMessage(message.from, loQueDijo);
    }

    // --- COMANDO PING ---
if (comando === 'ping') {
    const latencia = Date.now() - (message.timestamp * 1000);
    const memoria = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2); // Memoria RAM usada en MB
    
    return message.reply(`¡Pong!\n\n> *Latencia:* ${latencia}ms\n> *RAM:* ${memoria} MB\n> *Estado:* Online`);
}



if (message.body.startsWith("?charlist")) {

  const fs = require("fs");
  const personajes = JSON.parse(fs.readFileSync("./personajes.json"));

  const args = message.body.split(" ").slice(1);
  const filtroFuente = args.join(" ").trim();

  // Si NO escribe fuente → mostrar resumen general
  if (!filtroFuente) {

    const fuentes = {};

    personajes.forEach(p => {
      if (!fuentes[p.fuente]) {
        fuentes[p.fuente] = 0;
      }
      fuentes[p.fuente]++;
    });

    let respuesta = `📜 LISTA DE FUENTES\n\n`;
    respuesta += `Total de personajes: ${personajes.length}\n\n`;

    Object.keys(fuentes).sort().forEach(f => {
      respuesta += `🔹 ${f} (${fuentes[f]})\n`;
    });

    return message.reply(respuesta);
  }

  // Si SÍ escribe fuente → mostrar personajes de esa fuente

  const filtrados = personajes.filter(p =>
    p.fuente.toLowerCase() === filtroFuente.toLowerCase()
  );

  if (filtrados.length === 0) {
    return message.reply("❌ No se encontró esa fuente.");
  }

  let respuesta = `📜 ${filtroFuente.toUpperCase()}\n\n`;
  respuesta += `Personajes: ${filtrados.length}\n\n`;

  filtrados.forEach(p => {
    respuesta += `• ${p.nombre}\n`;
  });

  message.reply(respuesta);
}

// --------- ?pay ---------

if (comando.split(" ")[0] === 'pay') {

    try {

        if (!message.from.endsWith("@g.us")) {
            return message.reply("Este comando solo funciona en grupos.");
        }

        const partes = message.body.trim().split(/\s+/);

        if (partes.length < 3) {
            return message.reply("Uso: ?pay cantidad @usuario");
        }

        const cantidad = Number(partes[1]);

        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            return message.reply("Cantidad inválida.");
        }

        if (!message.mentionedIds || message.mentionedIds.length === 0) {
            return message.reply("Debes mencionar a alguien.");
        }

        const receiverId = String(message.mentionedIds[0]);
        const senderId = String(message.author || message.from);

        if (receiverId === senderId) {
            return message.reply("No puedes pagarte a ti mismo.");
        }

        const economia = cargarEconomia();

        asegurarUsuario(economia, senderId);
        asegurarUsuario(economia, receiverId);

        if (economia[senderId].dinero < cantidad) {
            return message.reply("No tienes suficiente dinero.");
        }

        economia[senderId].dinero -= cantidad;
        economia[receiverId].dinero += cantidad;

        guardarEconomia(economia);

        const numero = receiverId.split("@")[0];

        return message.reply(
            `💸 Transferencia realizada.
Enviaste $${cantidad} a @${numero}
Balance actual: $${economia[senderId].dinero}`
        );

    } catch (err) {
        console.log("ERROR EN PAY:", err);
        return message.reply("Ocurrió un error en el pago.");
    }
}

// ============== COMANDO ?cooldowns ====================
if (comando === 'cooldowns') {
    const ahora = Date.now();
    const grupoId = message.from;
    const userId = message.author || message.from;
    let texto = "◔ Tus cooldowns activos:\n\n";

    // --- COOLDOWN DE SMOB ---
    if (cooldownsBuscarmob[grupoId]?.[userId]) {
        const totalSmob = 15 * 60 * 1000;
        const restanteSmob = totalSmob - (ahora - cooldownsBuscarmob[grupoId][userId]);
        if (restanteSmob > 0)
            texto += `◔ smob → ${msToTime(restanteSmob)}\n`;
    }

    // --- COOLDOWN DE RW ---
    if (cooldownsRW[grupoId]?.[userId]) {
        const total = 15 * 60 * 1000;
        const restante = total - (ahora - cooldownsRW[grupoId][userId]);
        if (restante > 0)
            texto += `◔ rw → ${msToTime(restante)}\n`;
    }

    // --- COOLDOWN DE C ---
    if (cooldownsC[grupoId]?.[userId]) {
        const total = 20 * 60 * 1000;
        const restante = total - (ahora - cooldownsC[grupoId][userId]);
        if (restante > 0)
            texto += `◔ c → ${msToTime(restante)}\n`;
    }

    const economia = cargarEconomia();
    asegurarUsuario(economia, userId);

    // --- COOLDOWN DE WORK (W) ---
    const totalW = 60 * 1000;
    const restanteW = totalW - (ahora - (economia[userId].lastWork || 0));
    if (restanteW > 0)
        texto += `◔ w → ${msToTime(restanteW)}\n`;

    // --- COOLDOWN DE CRIME ---
    const totalCrime = 5 * 60 * 1000;
    const restanteCrime = totalCrime - (ahora - (economia[userId].lastCrime || 0));
    if (restanteCrime > 0)
        texto += `◔ crime → ${msToTime(restanteCrime)}\n`;

    // --- VERIFICACIÓN FINAL ---
    if (texto === "◔ Tus cooldowns activos:\n\n")
        texto += "◔ No tienes cooldowns activos.";

    return message.reply(texto);
}


	//====================== E C O N O M I A  ==========================

if (message.body === "?w") {
    const economia = cargarEconomia();
    const userId = message.author || message._data.participant || message.from;

    asegurarUsuario(economia, userId);

    const ahora = Date.now();
    const cooldown = 60 * 1000; // 1 minuto (puedes subirlo si sientes que dan mucho dinero muy rápido)

    if (ahora - (economia[userId].lastWork || 0) < cooldown) {
        const restante = cooldown - (ahora - (economia[userId].lastWork || 0));
        // Usamos tu función msToTime que ya tienes en el archivo
        return message.reply(`◔ Espera ${msToTime(restante)} para volver a trabajar.`);
    }

    // --- NUEVO RANGO DE TRABAJO (1k a 3k) ---
    const ganancia = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
    
    // Aseguramos que el dinero sea tratado como número para evitar el "NaN" o errores de suma
    economia[userId].dinero = (Number(economia[userId].dinero) || 0) + ganancia;
    economia[userId].lastWork = ahora;

    guardarEconomia(economia);

    message.reply(`⌨️ Has trabajado con éxito.\n\n💵 Ganaste: *$${ganancia.toLocaleString()}*\n💰 Balance Total: *$${economia[userId].dinero.toLocaleString()}*`);
}
	
if (message.body === "?crime") {
    const economia = cargarEconomia();
    const userId = message.author || message._data.participant || message.from;

    asegurarUsuario(economia, userId);

    const ahora = Date.now();
    const cooldown = 5 * 60 * 1000; // 5 minutos

    if (ahora - (economia[userId].lastCrime || 0) < cooldown) {
        const restante = cooldown - (ahora - (economia[userId].lastCrime || 0));
        return message.reply(`◔ Espera ${msToTime(restante)} para volver a intentar cometer un crimen.`);
    }

    // 50% de probabilidad de éxito
    const exito = Math.random() < 0.5;

    if (exito) {
        // --- GANANCIA ENTRE 5,000 Y 7,000 ---
        const ganancia = Math.floor(Math.random() * (7000 - 5000 + 1)) + 5000;
        economia[userId].dinero = (Number(economia[userId].dinero) || 0) + ganancia;

        message.reply(`✪ *¡CRIMEN EXITOSO!* ✪\n\n🕵️‍♂️ Lograste el golpe perfecto.\n💵 Ganaste: *$${ganancia.toLocaleString()}*\n💰 Balance actual: *$${economia[userId].dinero.toLocaleString()}*`);
    } else {
        // --- PÉRDIDA ENTRE 4,000 Y 6,000 (Riesgo alto) ---
        const perdida = Math.floor(Math.random() * (6000 - 4000 + 1)) + 4000;
        economia[userId].dinero = (Number(economia[userId].dinero) || 0) - perdida;
        
        // Evitar que el dinero sea negativo
        if (economia[userId].dinero < 0) economia[userId].dinero = 0;

        message.reply(`👮‍♂️ *¡TE ATRAPARON!* 👮‍♂️\n\nLa policía te confiscó el equipo y pagaste fianza.\n📉 Perdiste: *$${perdida.toLocaleString()}*\n💰 Balance actual: *$${economia[userId].dinero.toLocaleString()}*`);
    }

    economia[userId].lastCrime = ahora;
    guardarEconomia(economia);
}
	


if (comando === 'daily') {
    const economia = cargarEconomia();
    asegurarUsuario(economia, userId);

    const ahora = new Date();
    // Ajustamos la fecha de "último reclamo" del usuario
    const ultimoDaily = economia[userId].lastDaily ? new Date(economia[userId].lastDaily) : new Date(0);

    // Creamos la fecha del "Próximo Reset" (Hoy a las 9 PM)
    let proximoReset = new Date();
    proximoReset.setHours(21, 0, 0, 0);

    // Si ya pasaron las 9 PM de hoy, el reset real es mañana a las 9 PM
    if (ahora > proximoReset) {
        // Pero si el último reclamo fue ANTES de las 9 PM de hoy, ¡puede reclamar!
    }

    // Lógica simplificada: ¿El último reclamo fue antes del último punto de las 9 PM que ya pasó?
    let ultimoHito9PM = new Date();
    ultimoHito9PM.setHours(21, 0, 0, 0);
    if (ahora < ultimoHito9PM) {
        // Si aún no son las 9 PM hoy, el hito fue ayer a las 9 PM
        ultimoHito9PM.setDate(ultimoHito9PM.getDate() - 1);
    }

    if (ultimoDaily > ultimoHito9PM) {
        // Calcular cuánto falta para las próximas 9 PM
        let siguiente9PM = new Date();
        siguiente9PM.setHours(21, 0, 0, 0);
        if (ahora >= siguiente9PM) siguiente9PM.setDate(siguiente9PM.getDate() + 1);
        
        const faltantems = siguiente9PM - ahora;
        const horas = Math.floor(faltantems / 3600000);
        const minutos = Math.floor((faltantems % 3600000) / 60000);

        return message.reply(`⏳ Ya reclamaste tu recompensa diaria.\nRegresa en *${horas}h ${minutos}m* (a las 9:00 PM).`);
    }

    // --- ENTREGAR PREMIO ---
    const premio = 45000; // Ajusta el premio a tu gusto
    economia[userId].dinero += premio;
    economia[userId].lastDaily = ahora.getTime();

    guardarEconomia(economia);

    return message.reply(`🎁 *RECOMPENSA DIARIA*\n\nHas recibido *$${premio.toLocaleString()}*.\n¡Vuelve después de las 9:00 PM para tu siguiente regalo!`);
}

if (message.body === "?bal") {
    const userId = message.author || message.author || message.from;
    
    // 1. Usa 'carteras', que es la variable global que usa el resto del bot
    asegurarUsuario(carteras, userId); 

    // 2. Lee el dato de 'carteras'
    const saldo = carteras[userId].dinero || 0;

    message.reply(`💰 *TU BILLETERA*\n━━━━━━━━━━━━━━\n» Balance actual: *$${saldo.toLocaleString()}*`);
}

// ==========================================
//           SISTEMA DE TIENDA (SHOP)
// ==========================================

// --------- COMANDO ?shop ---------
if (comando === 'shop') {
    // 1. Aseguramos que el usuario exista en la variable GLOBAL 'carteras'
    asegurarUsuario(carteras, userId); 
    
    // 2. Extraemos el dinero directamente de la RAM
    const miDinero = carteras[userId].dinero || 0;
    
    let tabla = `🛒 *TIENDA DE LUJO YAKBOT*\n`;
    tabla += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    tabla += `1️⃣ *Poción de Energía* (⚡+50)\n`;
    tabla += `   ╰┈─ ➤ Precio: $15,000\n`;
    tabla += `   ╰┈─ ➤ Uso: ?buy 1 Nombre\n\n`;
    
    tabla += `2️⃣ *Amuleto Maestro* (✨+100 XP)\n`;
    tabla += `   ╰┈─ ➤ Precio: $35,000\n`;
    tabla += `   ╰┈─ ➤ Uso: ?buy 2 Nombre\n\n`;
    
    tabla += `3️⃣ *Piedra de Evolución* (⭐ +1 Nivel Directo)\n`;
    tabla += `   ╰┈─ ➤ Precio: $80,000\n`;
    tabla += `   ╰┈─ ➤ Uso: ?buy 3 Nombre\n\n`;
    
    tabla += `4️⃣ *Bendición del Admin* (💖 +2 Niveles y Full Stamina)\n`;
    tabla += `   ╰┈─ ➤ Precio: $150,000\n`;
    tabla += `   ╰┈─ ➤ Uso: ?buy 4 Nombre\n\n`;
    
    tabla += `5️⃣ *Contrato Eterno* (📜 +50% Valor Base Permanente)\n`;
    tabla += `   ╰┈─ ➤ Precio: $300,000\n`;
    tabla += `   ╰┈─ ➤ Uso: ?buy 5 Nombre\n\n`;
    
    tabla += `━━━━━━━━━━━━━━━━━━━━\n`;
    // 3. Mostramos el balance usando la variable que creamos arriba
    tabla += `⌬ Tu Balance: *$${miDinero.toLocaleString()}*`;
    
    return message.reply(tabla);
}

// --------- COMANDO ?buy ---------
if (comando.startsWith('buy')) {
    // 1. LIMPIEZA: No cargamos archivos, usamos carteras (global)
    asegurarUsuario(carteras, userId);
    const args = message.body.slice(prefix.length + 3).trim().split(/\s+/);
    const itemNum = args[0];
    const targetName = args.slice(1).join(' ').toLowerCase().trim();

    if (!itemNum || !targetName) return message.reply(`❌ Uso: ${prefix}buy [número] [nombre del personaje]`);

    // Usamos haremPorGrupo (global)
    const userHarem = haremPorGrupo[grupoId]?.[userId] || [];
    const index = userHarem.findIndex(p => p.nombre.toLowerCase() === targetName);
    if (index === -1) return message.reply(`❌ No tienes a **${targetName}**.`);

    let personaje = userHarem[index];
    let mensajeExtra = ""; // Para avisar de la evolución

    if (itemNum === '1') { // POCIÓN
        if (carteras[userId].dinero < 15000) return message.reply("No tienes suficiente dinero ($15,000).");
        carteras[userId].dinero -= 15000;
        personaje.stamina = Math.min(100, (personaje.stamina || 0) + 50);
        message.reply(`🧪 *Poción* usada en ${personaje.nombre}. Stamina: ${personaje.stamina}%`);
    } 
    else if (itemNum === '2') { // AMULETO
        if (carteras[userId].dinero < 35000) return message.reply("No tienes suficiente dinero ($35,000).");
        carteras[userId].dinero -= 35000;
        personaje.exp = (personaje.exp || 0) + 100;
        
        // Usamos tu lógica de nivelación de 100 XP por nivel para ser consistentes
        while (personaje.exp >= (Number(personaje.level) || 1) * 100) {
            personaje.exp -= (Number(personaje.level) || 1) * 100;
            personaje.level = (Number(personaje.level) || 1) + 1;
            mensajeExtra = `\n🆙 ¡SUBIÓ AL NIVEL ${personaje.level}!`;
        }
    } 
    else if (itemNum === '3') { // PIEDRA
        if (carteras[userId].dinero < 80000) return message.reply("No tienes suficiente dinero ($80,000).");
        carteras[userId].dinero -= 80000;
        personaje.level = (Number(personaje.level) || 1) + 1;
        message.reply(`⭐ ¡${personaje.nombre} subió al nivel ${personaje.level}!`);
    } 
    else if (itemNum === '4') { // BENDICIÓN
        if (carteras[userId].dinero < 150000) return message.reply("No tienes suficiente dinero ($150,000).");
        carteras[userId].dinero -= 150000;
        personaje.stamina = 100;
        personaje.level = (Number(personaje.level) || 1) + 2;
        message.reply(`💖 ¡${personaje.nombre} ha sido bendecido!\n🆙 +2 Niveles (Nivel actual: ${personaje.level})\n⚡ Energía al 100%`);
    } 
    else if (itemNum === '5') { // CONTRATO
        if (carteras[userId].dinero < 300000) return message.reply("No tienes suficiente dinero ($300,000).");
        carteras[userId].dinero -= 300000;
        personaje.valor = Math.floor(personaje.valor * 1.5);
        message.reply(`📜 *Contrato Eterno* firmado.\n📈 Valor base subió a ${personaje.valor.toLocaleString()}.`);
    } 

    // --- BLOQUE DE EVOLUCIÓN AUTOMÁTICA (Para items 2, 3 y 4) ---
    if (personaje.nivelEvo && personaje.level >= personaje.nivelEvo) {
        const datosEvo = personajes.find(pe => pe.nombre.toLowerCase() === personaje.evolucion.toLowerCase());
        if (datosEvo) {
            const nombreViejo = personaje.nombre;
            personaje.nombre = datosEvo.nombre;
            personaje.imagen = datosEvo.imagen;
            personaje.valor = datosEvo.valor;
            personaje.evolucion = datosEvo.evolucion || null;
            personaje.nivelEvo = datosEvo.nivelEvo || null;
            
            // Enviamos mensaje de evolución
            message.reply(`✨ ¡Increíble! Gracias al objeto, *${nombreViejo}* ha evolucionado a... ¡*${personaje.nombre}*! 🎉`);
        }
    }

    // AVISAMOS AL RELOJ (No guardamos a disco manualmente)
    economiaSucia = true;
    haremSucio = true;
}

	

// ==========================================
//          COMANDOS DE CHARSHOP (NUEVO FORMATO)
// ==========================================
if (comando === 'charshop') {
    actualizarCharShop(grupoId);
    const shopDelGrupo = charShopsPorGrupo[grupoId];
    const tiempoRestante = 3000000 - (Date.now() - shopDelGrupo.ultimaActualizacion);
    
    let msg = `🏪 *MERCADO DE PERSONAJES*\n`;
    msg += `⏱️ Rotación en: ${msToTime(tiempoRestante)}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (shopDelGrupo.personajes.length === 0) {
        msg += "⚠️ No hay personajes disponibles en esta rotación.";
    } else {
        shopDelGrupo.personajes.forEach((p, i) => {
            msg += `*${i + 1}*\n`;
            msg += `╰┈─ ➤ *Personaje:* ${p.nombre}\n`;
            msg += `╰┈─ ➤ *Anime:* ${p.fuente}\n`;
            msg += `╰┈─ ➤ *Costo:* $${p.precio.toLocaleString()}\n`;
            msg += `╰┈─ ➤ *Comprar:* \`?bchar ${i + 1}\`\n\n`;
        });
    }

    // --- SINCRONIZACIÓN CON RAM ---
    asegurarUsuario(carteras, userId); 
    const saldo = carteras[userId].dinero || 0;
    
    msg += `━━━━━━━━━━━━━━━━━━━━\n⌬ Tu Saldo: *$${saldo.toLocaleString()}*`;
    
    return message.reply(msg);
}
	
if (comando.startsWith('bchar')) {
    actualizarCharShop(grupoId);
    const shopDelGrupo = charShopsPorGrupo[grupoId];
    
    const argsB = message.body.trim().split(/\s+/);
    const numeroInput = parseInt(argsB[1]);
    const indice = numeroInput - 1;

    if (isNaN(numeroInput) || !shopDelGrupo || !shopDelGrupo.personajes[indice]) {
        return message.reply("❌ Número inválido. Usa: `?bchar [número]`");
    }

    const item = shopDelGrupo.personajes[indice];
    
    // --- USAR CARTERAS (GLOBAL) ---
    asegurarUsuario(carteras, userId);
    const dineroUsuario = carteras[userId].dinero || 0;

    if (dineroUsuario < item.precio) {
        const falta = item.precio - dineroUsuario;
        return message.reply(`❌ Dinero insuficiente.\n💰 Precio: *$${item.precio.toLocaleString()}*\n💵 Tienes: *$${dineroUsuario.toLocaleString()}*\n📉 Faltan: *$${falta.toLocaleString()}*`);
    }

    // Inicializar Harem en RAM si no existe
    if (!haremPorGrupo[grupoId]) haremPorGrupo[grupoId] = {};
    if (!haremPorGrupo[grupoId][userId]) haremPorGrupo[grupoId][userId] = [];

    try {
        // TRANSACCIÓN EN RAM
        carteras[userId].dinero -= item.precio;

        const nuevoPersonaje = { 
            nombre: item.nombre,
            fuente: item.fuente,
            valor: item.valor,
            imagen: item.imagen || "",
            level: 1, 
            exp: 0, 
            stamina: 100, 
            lastUpdate: Date.now() 
        };

        // Guardar en RAM
        haremPorGrupo[grupoId][userId].push(nuevoPersonaje);
        
        // Quitar de la tienda
        shopDelGrupo.personajes.splice(indice, 1);

        // --- ACTIVAR BANDERAS PARA EL RELOJ ---
        economiaSucia = true;
        haremSucio = true;

        return message.reply(`🎉 ¡COMPRA EXITOSA!\n\nHas adquirido a: *${item.nombre}*\n💰 Saldo restante: *$${carteras[userId].dinero.toLocaleString()}*`);
        
    } catch (e) {
        console.log("Error en bchar:", e);
        return message.reply("⚠️ Error al procesar la compra.");
    }
}


// ============= COMANDO ?baltop (RANKING) =============
if (comando === 'baltop') {
    let usuarios = [];

    // Convertimos el objeto en una lista para poder ordenarla
    for (let id in eco) {
        usuarios.push({
            id: id,
            dinero: Number(eco[id].dinero) || 0
        });
    }

    // Ordenamos de mayor a menor dinero
    usuarios.sort((a, b) => b.dinero - a.dinero);

    // Tomamos los 10 mejores
    const top10 = usuarios.slice(0, 10);

    let textoTop = "🏆 *RANKING DE RIQUEZA* 🏆\n\n";
    let mentions = [];

    top10.forEach((user, index) => {
        const num = user.id.split('@')[0];
        const medalla = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "👤";
        textoTop += `${medalla} ${index + 1}. @${num}: *$${user.dinero.toLocaleString()}*\n`;
        mentions.push(user.id); // Guardamos la ID para que se vea la mención azul
    });

    if (usuarios.length === 0) return message.reply("❌ No hay registros de economía todavía.");

    // Enviamos el mensaje con las menciones habilitadas
    client.sendMessage(message.from, textoTop, { mentions });
}

// --------- ?duel ---------

if (comando.split(" ")[0] === 'duel') {

    try {

        if (!message.from.endsWith("@g.us")) {
            return message.reply("Solo funciona en grupos.");
        }

        if (duelosActivos[grupoId]) {
            return message.reply("Ya hay un duelo activo en este grupo.");
        }

        if (!message.mentionedIds || message.mentionedIds.length === 0) {
            return message.reply("Debes mencionar a alguien.");
        }

        const jugador1 = String(message.author || message.from);
        const jugador2 = String(message.mentionedIds[0]);

        if (jugador1 === jugador2) {
            return message.reply("No puedes retarte a ti mismo.");
        }

        const timeoutAceptacion = setTimeout(() => {
            if (duelosActivos[grupoId]) {
                delete duelosActivos[grupoId];
                message.reply("◔ El duelo expiró por no ser aceptado.");
            }
        }, 5 * 60 * 1000);

        duelosActivos[grupoId] = {
            jugador1,
            jugador2,
            picks: {},
            aceptado: false,
            timeoutAceptacion
        };

        const numero = jugador2.split("@")[0];

        return message.reply(
            `⚔ Duelo iniciado.
@${numero} escribe ?accept para aceptar.
Tienes 5 minutos.`
        );

    } catch (err) {
        console.log("ERROR EN DUEL:", err);
        return message.reply("Ocurrió un error iniciando el duelo.");
    }
}

if (comando === 'accept') {

    if (!duelosActivos[grupoId]) {
        return message.reply("No hay duelo pendiente.");
    }

    const duelo = duelosActivos[grupoId];

    if (userId !== duelo.jugador2) {
        return message.reply("No eres el jugador retado.");
    }

    clearTimeout(duelo.timeoutAceptacion);
    duelo.aceptado = true;

    // En comando 'accept'
duelo.timeoutPick = setTimeout(() => {
    if (duelosActivos[grupoId]) {
        delete duelosActivos[grupoId];
        message.reply("⏱️ Se acabó el tiempo para elegir personajes.");
    }
}, 600000); // 10 minutos para ?pick

    message.reply("⇎ Duelo aceptado.\nAmbos jugadores tienen 5 minutos para elegir:\n?pick goku, seven, alucard");
}

// --------- ?pick (3v3) ---------
if (comando.startsWith('pick')) {
    // 1. Seguridad: Verificar si existe el duelo en este grupo
    if (!duelosActivos[grupoId]) return;
    const duelo = duelosActivos[grupoId];
    
    // Verificar que el que escribe sea uno de los participantes
    if (userId !== duelo.jugador1 && userId !== duelo.jugador2) return;

    const textoOriginal = message.body.slice(prefix.length + 5).trim();
    const nombres = textoOriginal.split(",").map(n => n.trim());

    if (nombres.length < 1 || nombres.length > 3) {
        return message.reply("❌ Debes elegir entre 1 y 3 personajes separados por coma.");
    }

    const miHarem = haremPorGrupo[grupoId]?.[userId] || [];
    if (miHarem.length === 0) return message.reply("❌ No tienes personajes en este grupo.");

    let equipo = [];
    let valorTotal = 0;
    let tieneADeadpool = false;

    for (let nombre of nombres) {
        const personaje = miHarem.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());

        if (!personaje) return message.reply(`❌ No tienes a ${nombre}.`);

        actualizarStamina(personaje);
        
        if (personaje.nombre === 'Deadpool') {
            tieneADeadpool = true;
            personaje.stamina = 100; 
        } else if (personaje.stamina <= 10) {
            return message.reply(`😫 ${personaje.nombre} está muy cansado (${personaje.stamina}%).`);
        }

        // Poder basado en nivel
        let valorReal = Number(personaje.valor) * Math.pow(1.20, (personaje.level - 1));

        if (personaje.nombre === 'Deadpool' && Math.random() < 0.20) {
            valorReal *= 5; 
            message.reply("🔴 *DEADPOOL:* ¡Me subí las stats hackeando el bot! 💥");
        }

        valorTotal += valorReal; 

        if (personaje.nombre !== 'Deadpool') {
            personaje.stamina = Math.max(0, personaje.stamina - 30);
            personaje.lastUpdate = Date.now();
        }

        if (equipo.find(p => p.nombre === personaje.nombre)) return message.reply("❌ No puedes repetir personajes.");
        equipo.push(personaje);
    }

    // Guardar picks en RAM
    if (!duelo.picks) duelo.picks = {};
    duelo.picks[userId] = { equipo, valorTotal };
    
    let msgConfirm = "✅ Equipo seleccionado.";
    if (tieneADeadpool) msgConfirm += "\n🔴 *DP:* ¡Prepárense para la masacre! 🌮";
    message.reply(msgConfirm);

    // --- RESOLUCIÓN DEL DUELO ---
    if (duelo.picks[duelo.jugador1] && duelo.picks[duelo.jugador2]) {
        clearTimeout(duelo.timeoutPick);

        const equipo1 = duelo.picks[duelo.jugador1];
        const equipo2 = duelo.picks[duelo.jugador2];

        let poder1 = equipo1.valorTotal * (0.95 + Math.random() * 0.1);
        let poder2 = equipo2.valorTotal * (0.95 + Math.random() * 0.1);

        // Trampas de Deadpool
        if (equipo1.equipo.some(p => p.nombre === 'Deadpool') && Math.random() < 0.10) {
            poder1 += poder2; 
            message.reply("🔴 *DEADPOOL:* ¡Victoria por Deus Ex Machina! Ganamos.");
        } else if (equipo2.equipo.some(p => p.nombre === 'Deadpool') && Math.random() < 0.10) {
            poder2 += poder1;
            message.reply("🔴 *DEADPOOL:* ¡Puse C4 en sus stats! Victoria.");
        }

        const ganadorId = poder1 > poder2 ? duelo.jugador1 : duelo.jugador2;
        const perdedorId = poder1 > poder2 ? duelo.jugador2 : duelo.jugador1;

        // Economía (Usando variable global carteras)
        asegurarUsuario(carteras, ganadorId);
        asegurarUsuario(carteras, perdedorId);
        const robo = Math.floor((carteras[perdedorId].dinero || 0) * 0.15); // Bajé el robo al 15% para que no sea tan cruel

        carteras[perdedorId].dinero -= robo;
        carteras[ganadorId].dinero += robo;
        economiaSucia = true;

        // Lógica de XP y EVOLUCIÓN
        [equipo1, equipo2].forEach(eq => {
            const esGanador = (eq === (poder1 > poder2 ? equipo1 : equipo2));
            const xpGanada = esGanador ? 60 : 20;

            eq.equipo.forEach(p => {
                p.exp = (Number(p.exp) || 0) + xpGanada;
                let subioNivel = false;

                while (p.exp >= (Number(p.level) || 1) * 100) {
                    p.exp -= (Number(p.level) || 1) * 100;
                    p.level = (Number(p.level) || 1) + 1;
                    subioNivel = true;
                }

                // CHECK DE EVOLUCIÓN
                if (subioNivel && p.nivelEvo && p.level >= p.nivelEvo) {
                    const datosEvo = personajes.find(pe => pe.nombre.toLowerCase() === p.evolucion.toLowerCase());
                    if (datosEvo) {
                        p.nombre = datosEvo.nombre;
                        p.imagen = datosEvo.imagen;
                        p.valor = datosEvo.valor;
                        p.evolucion = datosEvo.evolucion || null;
                        p.nivelEvo = datosEvo.nivelEvo || null;
                        client.sendMessage(message.from, `✨ ¡*${p.nombre}* ha evolucionado después del duelo!`);
                    }
                }
            });
        });

        haremSucio = true;

        let mensajeFinal = `⇏ *RESULTADO DUELO 3v3* ⇍\n\n`;
        mensajeFinal += `👤 @${duelo.jugador1.split('@')[0]}: ${Math.floor(poder1).toLocaleString()}\n`;
        mensajeFinal += `👤 @${duelo.jugador2.split('@')[0]}: ${Math.floor(poder2).toLocaleString()}\n\n`;
        mensajeFinal += `🏆 GANADOR: @${ganadorId.split('@')[0]}\n💰 Recompensa: $${robo.toLocaleString()}`;

        client.sendMessage(message.from, mensajeFinal, { mentions: [duelo.jugador1, duelo.jugador2] });
        delete duelosActivos[grupoId];
    }
}


    if (comando === 'info') {
        return message.reply('YakBot v1.9.3\n⚡ Corriendo en Node 18\n🔥 Modo estable activado (la vdd me voya crashear tarde o temprano)');
    }

    if (comando === 'creador') {
        return message.reply('Fui creado por una mente esquizofrenica, Jack.');
    }

    if (comando === 'numero') {
        const num = Math.floor(Math.random() * 100) + 1;
        return message.reply(`Tu número random es: ${num}`);
    }

// --------- ?rw (PARCHEADO) ---------
if (comando === 'rw') {
    const userId = message.author || message._data.participant || message.from;

    // 1. BLOQUEO ANTI-SPAM (EL BUG QUE MENCIONASTE)
    // Si ya está procesando una petición en este chat, ignoramos las nuevas
    if (procesandoRW.has(chatId)) return; 

    // 2. Manejo de Cooldowns de tiempo (15 min)
    if (!cooldownsRW[grupoId]) cooldownsRW[grupoId] = {};
    const totalRW = 15 * 60 * 1000;

    if (cooldownsRW[grupoId][userId]) {
        const pasado = Date.now() - cooldownsRW[grupoId][userId];
        if (pasado < totalRW) {
            const restante = totalRW - pasado;
            return message.reply(`◔ Espera ${msToTime(restante)} para sacar a otro personaje`);
        }
    }

    // REGISTRAMOS QUE EMPEZAMOS A PROCESAR
    procesandoRW.add(chatId);

    try {
        // 3. Lógica de Selección
        let personaje;
        const listaPesos = personajes.map(p => {
            const v = parseInt(p.valor) || 1000;
            let pesoFinal;
            if (v >= 17000) {
                pesoFinal = 100 / Math.pow(v / 17000, 2.5); 
            } else {
                pesoFinal = 100; 
            }
            return { p, peso: pesoFinal };
        });

        const sumaPesosTotal = listaPesos.reduce((s, i) => s + i.peso, 0);
        let randomNum = Math.random() * sumaPesosTotal;
        
        personaje = personajes[Math.floor(Math.random() * personajes.length)];

        for (const item of listaPesos) {
            randomNum -= item.peso;
            if (randomNum <= 0) {
                personaje = item.p;
                break;
            }
        }

        // 4. Verificación de Estado
        let estado = "Libre";
        if (haremPorGrupo[grupoId]) {
            const yaReclamado = Object.values(haremPorGrupo[grupoId]).some(list =>
                list.find(p => p.nombre === personaje.nombre)
            );
            if (yaReclamado) estado = "Ya fue reclamado en este grupo";
        }

        // 5. Envío de imagen
        const url = personaje.imagen;
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const media = new MessageMedia('image/jpeg', buffer.toString('base64'), 'personaje.jpg');

        let avisoRareza = "";
        const vNum = parseInt(personaje.valor);
        if (vNum >= 20000) avisoRareza = "\n🌌 *¡ENTIDAD CÓSMICA DETECTADA!* 🌌";
        else if (vNum >= 17000) avisoRareza = "\n💎 *¡PERSONAJE LEGENDARIO!* 💎";

        const msgTexto = `✪ ¡Tiraste un personaje!${avisoRareza}
⟡ Nombre: ${personaje.nombre}
⚡︎ Valor: ${personaje.valor}
⚥ Género: ${personaje.genero}
⊹ Estado: ${estado}
➣ Fuente: ${personaje.fuente}

◇ Tienes 1 minuto para reclamar con ?c`;

        const sentMsg = await message.reply(media, undefined, { caption: msgTexto });

        // 6. Guardar tirada temporal y cooldown
        tiradasTemporales[sentMsg.id._serialized] = {
            personaje,
            grupoId,
            reclamado: false
        };

        cooldownsRW[grupoId][userId] = Date.now();

        setTimeout(() => {
            delete tiradasTemporales[sentMsg.id._serialized];
        }, 60 * 1000);

    } catch (error) {
        console.log('Error en RW:', error.message);
        message.reply('⚠ No pude cargar la imagen, pero sigo vivo por suerte!.');
    } finally {
        // 7. EL FINALLY MÁGICO: Pase lo que pase, liberamos el comando
        procesandoRW.delete(chatId);
    }
}

// --------- ?c ---------

if (comando === 'c') {

    // Inicializar cooldown por grupo si no existe
    if (!cooldownsC[grupoId]) cooldownsC[grupoId] = {};

    // Verificar que esté respondiendo a un mensaje
    if (!message.hasQuotedMsg) {
        return message.reply('⌦ Debes responder al mensaje del personaje para reclamarlo.');
    }

    const quoted = await message.getQuotedMessage();
    const tiradaId = quoted.id._serialized;

    // Verificar que la tirada exista
    if (!tiradasTemporales[tiradaId]) {
        return message.reply('⌦ Ese personaje ya expiró o no es válido.');
    }

    const tirada = tiradasTemporales[tiradaId];

    // Verificar que sea del mismo grupo
    if (tirada.grupoId !== grupoId) {
        return message.reply('⌦ Este personaje no pertenece a este grupo.');
    }

    // Verificar si ya fue reclamado
    if (tirada.reclamado) {
        return message.reply('⌦ Este personaje ya fue reclamado.');
    }

    // Verificar cooldown por usuario dentro del grupo
const tiempoTotal = 20 * 60 * 1000;

const totalC = 20 * 60 * 1000;

if (cooldownsC[grupoId][userId]) {
    const pasado = Date.now() - cooldownsC[grupoId][userId];

    if (pasado < totalC) {
        const restante = totalC - pasado;
        return message.reply(`◔ Espera ${msToTime(restante)} para reclamar un personaje`);
    }
}

    // Inicializar estructuras si no existen
    if (!haremPorGrupo[grupoId]) haremPorGrupo[grupoId] = {};
    if (!haremPorGrupo[grupoId][userId]) haremPorGrupo[grupoId][userId] = [];

    // Verificar si ya alguien lo tiene
    const yaReclamado = Object.values(haremPorGrupo[grupoId]).some(list =>
        list.find(p => p.nombre === tirada.personaje.nombre)
    );

    if (yaReclamado) {
        return message.reply('⌦ Este personaje ya fue reclamado.');
    }

    // Reclamar personaje
// Reclamar personaje
    const personajeConStats = {
        ...tirada.personaje, 
        level: 1,
        exp: 0,
        stamina: 100,
        lastUpdate: Date.now()
    };

    haremPorGrupo[grupoId][userId].push(personajeConStats);
    tirada.reclamado = true;
    guardarHarem(haremPorGrupo);

    // Guardar cooldown
    cooldownsC[grupoId][userId] = Date.now();

    // ... (Final de tu comando ?c actual)
    message.reply(`꧁¡Reclamaste a ${tirada.personaje.nombre}!꧂`);
} // <--- Este cierra el IF de ?c


// --------- ?harem ---------
if (comando === 'harem') {
    // 1. Identificar de quién es el harem (el tuyo o el de alguien más)
    const idUsuarioHarem = targetId || userId; 
    
    if (!haremPorGrupo[grupoId] || !haremPorGrupo[grupoId][idUsuarioHarem] || haremPorGrupo[grupoId][idUsuarioHarem].length === 0) {
        const mensajeVacio = idUsuarioHarem === userId ? '❒ Tu harem está vacío.' : '❒ Este usuario no tiene personajes.';
        return message.reply(mensajeVacio);
    }

    // 2. Obtener el nombre del dueño del harem
    const contacto = await client.getContactById(idUsuarioHarem);
    const nombreTitulo = (contacto.pushname || "Usuario").toUpperCase();

    // 3. Manejo de páginas (Detecta si el número está en args[0] o args[1])
    let pIndex = (message.mentionedIds.length > 0 || message.hasQuotedMsg) ? 1 : 0;
    let pagina = parseInt(args[pIndex]) || 1; 
    const personajesPorPagina = 20;

    // 4. Ordenar por Valor Real (RAM)
    let listaOrdenada = [...haremPorGrupo[grupoId][idUsuarioHarem]];
    listaOrdenada.sort((a, b) => {
        const vA = Math.floor((Number(a.valor) || 0) * Math.pow(1.20, (a.level || 1) - 1));
        const vB = Math.floor((Number(b.valor) || 0) * Math.pow(1.20, (b.level || 1) - 1));
        return vB - vA;
    });

    const totalPaginas = Math.ceil(listaOrdenada.length / personajesPorPagina);
    if (pagina < 1) pagina = 1;
    if (pagina > totalPaginas) pagina = totalPaginas;

    const inicio = (pagina - 1) * personajesPorPagina;
    const fin = inicio + personajesPorPagina;
    const personajesPagina = listaOrdenada.slice(inicio, fin);

    let respuesta = `༺ ${nombreTitulo} ༻\n`;
    respuesta += `━━━━━━━━━━━━━━━━━━━━\n`;
    respuesta += `          ᴘᴀ́ɢɪɴᴀ ${pagina} ᴅᴇ ${totalPaginas}\n\n`;

    personajesPagina.forEach((p, index) => {
        // Cálculo de valor con protección contra errores
        const valBase = Number(p.valor) || 0;
        const lvl = p.level || 1;
        const valorReal = Math.floor(valBase * Math.pow(1.20, lvl - 1));
        
        let numGlobal = (inicio + index + 1).toString().padStart(2, '0');
        
        if (p.nombre === 'Deadpool') {
            respuesta += `⌁ ${numGlobal} ⌁ 🔴 *DEADPOOL*\n`;
            respuesta += `    ╰┈─ ➤ Marvel ✦ (Valor Insuperable)\n\n`;
        } else {
            respuesta += `⌁ ${numGlobal} ⌁ ${p.nombre} (Lvl ${lvl})\n`;
            respuesta += `    ╰┈─ ➤ ${p.fuente} ✦ $${valorReal.toLocaleString()}\n\n`;
        }
    });

    respuesta += `━━━━━━━━━━━━━━━━━━━━\n`;
    respuesta += `⌬ Total: ${listaOrdenada.length} ⌁ Paginas: ${totalPaginas}\n`;
    respuesta += `⌬ Usa: ?harem [número] o ?harem @user`;

    return message.reply(respuesta);
}


if (comando.startsWith('wimage')) {
        const args = message.body.split(/\s+/).slice(1);
        const nombreBusqueda = args.join(" ").toLowerCase().trim();

        if (!nombreBusqueda) {
            return message.reply("❌ Uso: `?wimage [nombre]`\nEjemplo: `?wimage goku`.");
        }

        // Buscamos en la base de datos global 'personajes'
        const pj = personajes.find(p =>
    p.nombre.toLowerCase() === nombreBusqueda ||
    p.nombre.toLowerCase().startsWith(nombreBusqueda)
);

        if (!pj) {
            return message.reply(`❌ No encontré a "${nombreBusqueda}" en la base de datos.`);
        }

        try {
            // Intentamos obtener la imagen
            const media = await MessageMedia.fromUrl(pj.imagen).catch(() => null);

            const caption = `*PERSONAJE ENCONTRADO*\n\n` +
                            `👤 *Nombre:* ${pj.nombre}\n` +
                            `📺 *Fuente:* ${pj.fuente}`;

            if (media) {
                await client.sendMessage(message.from, media, { caption: caption });
            } else {
                // Si la URL de la imagen falla, enviamos solo el texto con un aviso
                await message.reply(`${caption}\n\n⚠️ _No se pudo cargar la imagen de este personaje._`);
            }

        } catch (err) {
            console.error("Error en wimage:", err);
            message.reply("⚠️ Hubo un error al procesar la imagen.");
        }
    }


// --------- ?charinfo (CORREGIDO) ---------
if (comando.startsWith('charinfo')) {
    const nombreBusqueda = message.body.slice(prefix.length + 8).trim().toLowerCase(); 
    if (!nombreBusqueda) return message.reply("❌ Escribe el nombre del personaje.");

    

    const grupoId = message.from;
    const userId = message.author || message.from;

    if (!haremPorGrupo[grupoId] || !haremPorGrupo[grupoId][userId]) {
        return message.reply("❒ Tu harem está vacío en este grupo.");
    }

    const miHarem = haremPorGrupo[grupoId][userId];

    // --- LÓGICA DE BÚSQUEDA PRIORIZADA ---
    // 1. Intentamos buscar una coincidencia EXACTA primero
    let personaje = miHarem.find(p => p.nombre.toLowerCase() === nombreBusqueda);

    // 2. Si no hay exacta, buscamos uno que EMPIECE por ese nombre
    if (!personaje) {
        personaje = miHarem.find(p => p.nombre.toLowerCase().startsWith(nombreBusqueda));
    }

    // 3. Si aún no hay nada, buscamos que CONTENGA el nombre (como último recurso)
    if (!personaje) {
        personaje = miHarem.find(p => p.nombre.toLowerCase().includes(nombreBusqueda));
    }

    if (!personaje) return message.reply(`❌ No tienes a "${nombreBusqueda}" en tu colección.`);

    // Asegurar valores por defecto
    const lvl = Number(personaje.level) || 1;
    const exp = Number(personaje.exp) || 0;
    const stamina = personaje.stamina !== undefined ? personaje.stamina : 100;
    
    // Fórmulas consistentes con el resto del bot
    const xpSiguienteNivel = lvl * 100; // Ajustado a tu nueva lógica de nivelación
    const poderReal = Math.floor(Number(personaje.valor) * Math.pow(1.20, (lvl - 1)));

    let infoMsg = `👤 *DETALLES DEL PERSONAJE*\n`;
    infoMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    infoMsg += `⭐ *Nombre:* ${personaje.nombre}\n`;
    infoMsg += `🎬 *Serie:* ${personaje.fuente}\n`;
    infoMsg += `📊 *Nivel:* ${lvl}\n`;
    infoMsg += `✨ *XP:* ${exp} / ${xpSiguienteNivel}\n`;
    infoMsg += `⚔️ *Poder Real:* ${poderReal.toLocaleString()}\n`;
    infoMsg += `⚡ *Energía:* ${stamina}%\n\n`;
    infoMsg += `━━━━━━━━━━━━━━━━━━━━`;

    try {
        const response = await axios.get(personaje.imagen, { responseType: 'arraybuffer' });
        const media = new MessageMedia('image/jpeg', Buffer.from(response.data).toString('base64'), 'char.jpg');
        await client.sendMessage(grupoId, media, { caption: infoMsg });
    } catch (error) {
        message.reply(infoMsg);
    }
}


// --------- COMANDO ?dice (APUESTAS) ---------
if (comando.startsWith('dice')) {
    const argsD = message.body.trim().split(/\s+/);
    const apuesta = parseInt(argsD[1]);

    if (isNaN(apuesta) || apuesta <= 0) {
        return message.reply(`❏ *Uso:* ${prefix}dice [cantidad]`);
    }

    const economia = cargarEconomia();
    asegurarUsuario(economia, userId);

    if (economia[userId].dinero < apuesta) {
        return message.reply("❏ *Error:* No tienes suficiente dinero para esta apuesta.");
    }

    // Lógica: 1-3 Pierde, 4-6 Gana
    const resultado = Math.floor(Math.random() * 6) + 1;
    let msgDice = `『  *DADOS* 』\n\n↳ Sacaste: [ ${resultado} ]\n`;

    if (resultado >= 4) {
        economia[userId].dinero += apuesta;
        msgDice += `↳ *RESULTADO:* Ganaste $${apuesta.toLocaleString()}\n`;
    } else {
        economia[userId].dinero -= apuesta;
        msgDice += `↳ *RESULTADO:* Perdiste $${apuesta.toLocaleString()}\n`;
    }

    msgDice += `↳ *SALDO ACTUAL:* $${economia[userId].dinero.toLocaleString()}`;
    
    guardarEconomia(economia);
    return message.reply(msgDice);
}

if (comando.startsWith('ship')) {
    const chat = await message.getChat();
    if (!chat.isGroup) return message.reply("Este comando solo funciona en grupos.");

    const participantes = chat.participants;
    if (participantes.length < 2) return message.reply("No hay suficientes personas para un ship.");

    // Seleccionar dos personas al azar
    const p1 = participantes[Math.floor(Math.random() * participantes.length)];
    let p2 = participantes[Math.floor(Math.random() * participantes.length)];

    // Evitar que se shipee con sigo mismo
    while (p2.id._serialized === p1.id._serialized) {
        p2 = participantes[Math.floor(Math.random() * participantes.length)];
    }

    // --- AQUÍ ESTÁ EL TRUCO PARA LOS NOMBRES ---
    const contacto1 = await client.getContactById(p1.id._serialized);
    const contacto2 = await client.getContactById(p2.id._serialized);

    // Si pushname no existe, usamos el número limpio
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

    // Enviamos el mensaje mencionando a ambos para que salgan los nombres
    return client.sendMessage(message.from, textoShip, {
        mentions: [p1.id._serialized, p2.id._serialized]
    });
}


// --------- ?givechar ---------
if (comando === 'givechar') {
    if (!message.from.endsWith("@g.us")) return message.reply("❌ Solo en grupos.");
    
    // Usamos el targetId universal (mención o respuesta)
    if (!targetId) return message.reply("❌ Menciona a alguien o responde a su mensaje.");

    // Limpiamos el nombre: quitamos la mención y unimos el resto
    const nombrePJ = args.join(" ").replace(/@\d+\s*/g, "").trim().toLowerCase();
    if (!nombrePJ) return message.reply(`❌ Uso: ${prefix}givechar @usuario Nombre`);

    const giver = userId;
    const receptor = targetId;

    if (!haremPorGrupo[grupoId]?.[giver]) return message.reply("❌ No tienes personajes.");
    if (!haremPorGrupo[grupoId][receptor]) haremPorGrupo[grupoId][receptor] = [];

    // Buscamos ignorando mayúsculas
    const miHarem = haremPorGrupo[grupoId][giver];
    const index = miHarem.findIndex(p => p.nombre.toLowerCase() === nombrePJ);

    if (index === -1) return message.reply(`❌ No tienes a "${nombrePJ}". Revisa el nombre en ?charlist`);

    // --- OPERACIÓN ---
    const [personaje] = miHarem.splice(index, 1);
    haremPorGrupo[grupoId][receptor].push(personaje);

    haremSucio = true; // Guardado automático

    return client.sendMessage(message.from, 
        `🎁 *REGALO EXITOSO*\n\n*${personaje.nombre}* ahora le pertenece a @${receptor.split('@')[0]}`,
        { mentions: [receptor] }
    );
}

	
// --- COMANDO TRADUCTOR ---
if (message.body.startsWith(prefix + 'tr ')) {
    const text = message.body.slice(prefix.length + 3).trim();
    if (!text) return message.reply("❌ Escribe lo que quieres traducir. Ej: `?tr hello world`");

    try {
        // Usamos la API gratuita de Google Translate (vía un puente rápido)
        const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text)}`);
        
        const translation = res.data[0].map(item => item[0]).join('');
        const detectedLang = res.data[2];

        message.reply(`🔠 *Traducción (${detectedLang} ➔ es):*\n\n${translation}`);
    } catch (e) {
        console.error(e);
        message.reply("⚠️ No pude traducir ese texto.");
    }
}

// --------- ?trade ---------
if (comando === 'trade') {
    if (!message.from.endsWith("@g.us")) return message.reply("❌ Solo en grupos.");
    if (tradesPendientes[grupoId]) return message.reply("⚠️ Ya hay un trade pendiente aquí.");
    if (!targetId || targetId === userId) return message.reply("❌ Menciona a alguien para tradear.");

    const textoTrade = args.join(" ").replace(/@\d+\s*/g, "");
    const partes = textoTrade.split("|");

    if (partes.length !== 2) return message.reply("❌ Uso: `?trade @usuario Mi PJ | Su PJ` (Usa el palito `|`) ");

    const miNombre = partes[0].trim().toLowerCase();
    const suNombre = partes[1].trim().toLowerCase();

    const miPJ = haremPorGrupo[grupoId]?.[userId]?.find(p => p.nombre.toLowerCase() === miNombre);
    const suPJ = haremPorGrupo[grupoId]?.[targetId]?.find(p => p.nombre.toLowerCase() === suNombre);

    if (!miPJ) return message.reply(`❌ No tienes a "${miNombre}".`);
    if (!suPJ) return message.reply(`❌ Esa persona no tiene a "${suNombre}".`);

    tradesPendientes[grupoId] = {
        iniciador: userId,
        receptor: targetId,
        miPJNombre: miPJ.nombre, // Guardamos el nombre real (con mayúsculas)
        suPJNombre: suPJ.nombre,
        timeout: setTimeout(() => { delete tradesPendientes[grupoId]; }, 60000)
    };

    return client.sendMessage(message.from, 
        `🔄 *PROPUESTA DE TRADE*\n\n` +
        `👤 @${userId.split('@')[0]} ofrece: *${miPJ.nombre}*\n` +
        `👤 @${targetId.split('@')[0]} ofrece: *${suPJ.nombre}*\n\n` +
        `✅ @${targetId.split('@')[0]}, pon *?aceptartrade* para confirmar.`,
        { mentions: [userId, targetId] }
    );
}

// --------- ?aceptartrade ---------
if (comando === "aceptartrade") {
    const trade = tradesPendientes[grupoId];
    if (!trade) return message.reply("❌ No hay intercambios pendientes.");
    if (userId !== trade.receptor) return message.reply("❌ Solo el receptor puede aceptar.");

    const haremA = haremPorGrupo[grupoId][trade.iniciador];
    const haremB = haremPorGrupo[grupoId][trade.receptor];

    // Buscamos los índices en el momento exacto de la aceptación
    const idxA = haremA.findIndex(p => p.nombre === trade.miPJNombre);
    const idxB = haremB.findIndex(p => p.nombre === trade.suPJNombre);

    if (idxA === -1 || idxB === -1) {
        delete tradesPendientes[grupoId];
        return message.reply("❌ El trade falló: uno de los personajes ya no está disponible.");
    }

    // INTERCAMBIO REAL
    const [pjA] = haremA.splice(idxA, 1);
    const [pjB] = haremB.splice(idxB, 1);

    haremA.push(pjB);
    haremB.push(pjA);

    haremSucio = true; // Sincroniza con el archivo harem.json
    clearTimeout(trade.timeout);
    delete tradesPendientes[grupoId];

    return client.sendMessage(message.from, 
        `🤝 *TRADE COMPLETADO*\n\n¡Intercambio realizado con éxito entre @${trade.iniciador.split('@')[0]} y @${trade.receptor.split('@')[0]}!`,
        { mentions: [trade.iniciador, trade.receptor] }
    );
}
	
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



