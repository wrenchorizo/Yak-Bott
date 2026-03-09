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
const qrcode = require('qrcode-terminal');
const fs = require('fs');

let botSettings = {};
if (fs.existsSync('./botSettings.json')) {
    botSettings = JSON.parse(fs.readFileSync('./botSettings.json'));
}
const sharp = require('sharp');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const play = require('play-dl');
const { exec } = require('child_process');
const axios = require('axios');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const yts = require('yt-search');
const ffmpeg = require('fluent-ffmpeg');
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
    ]
};

// Variable para los cooldowns en memoria (se reinicia al apagar el bot)
let cooldownsBuscarmob = {}; 

// Variable para guardar el mob que aparece en cada grupo
let mobActual = {};
const mobsData = [
    { nombre: 'Feministas', lvls: [5, 9], desc: 'Protestan por tu presencia.' },
    { nombre: 'Moscas', lvls: [10, 50], desc: 'Un zumbido molesto pero letal.' },
    { nombre: 'Esqueletos', lvls: [100, 500], desc: 'Huesos crujientes que buscan pelea.' },
    { nombre: 'Zombies', lvls: [1000, 3500], desc: 'Cerebros... y tu dinero.' },
    { nombre: 'Devastadores', lvls: [5000, 8000], desc: 'Máquinas de destrucción masiva.' },
    { nombre: 'Piratas', lvls: [10000, 12000], desc: 'Buscadores de tesoros del Grand Line.' },
    { nombre: 'Ejército de Viltrumitas', lvls: [15000, 17000], desc: 'Omni-man estaría orgulloso.' },
    { nombre: 'Soldados de Freezer', lvls: [20000, 30000], desc: 'La élite galáctica del emperador.' },
    { nombre: 'Celestiales errantes', lvls: [30000, 60000], desc: 'Entidades cósmicas fuera de control.' },
    { nombre: 'Guerreros Universales', lvls: [70000, 100000], desc: 'Los más fuertes de todos los universos.' }
];

const procesandoRW = new Set(); 

const haremFile = './harem.json';

function msToTime(ms) {
    const minutos = Math.floor(ms / 60000);
    const segundos = Math.floor((ms % 60000) / 1000);
    return `${minutos}m ${segundos}s`;
}

function cargarHarem() {
    if (!fs.existsSync(haremFile)) {
        fs.writeFileSync(haremFile, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(haremFile));
}

function guardarHarem(data) {
    fs.writeFileSync(haremFile, JSON.stringify(data, null, 2));
}

const duelosActivos = {};
const tradesPendientes = {};

const economiaFile = './economia.json';

function cargarEconomia() {
    if (!fs.existsSync(economiaFile)) {
        fs.writeFileSync(economiaFile, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(economiaFile));
}

function guardarEconomia(data) {
    fs.writeFileSync(economiaFile, JSON.stringify(data, null, 2));
}


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
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
        // NO PONGAS executablePath AQUÍ. 
        // Deja que Puppeteer lo busque solo.
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
// Ejecutar limpieza de personajes antiguos al encender
    haremPorGrupo = cargarHarem(); // Recargamos por si acaso
    limpiarHaremNaN(haremPorGrupo);
});

// ---------------- VARIABLES GLOBALES ----------------

const personajes = JSON.parse(fs.readFileSync('./personajes.json'));
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

// ---------------- MENSAJES ----------------

client.on('message_create', async (message) => {
    // 1. COMENTA ESTA LÍNEA (Poner // al inicio la desactiva)
    // if (message.fromMe) return; 

    // 2. AGREGA ESTE LOG (Para que veas en Railway si el mensaje llega)
    console.log(`[MENSAJE] De: ${message.from} | Texto: ${message.body}`);

    const prefix = '?';
    
    // 3. VALIDACIÓN DE PREFIJO
    if (!message.body.startsWith(prefix)) return;

    const args = message.body.slice(prefix.length).trim().split(/ +/);
    const comando = args.shift().toLowerCase();


console.log("fromMe:", message.fromMe);

    const texto = message.body.toLowerCase();
    if (!texto.startsWith(prefix)) return;

console.log("Comando detectado:", comando);
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
            const menuText = `📜 *MENÚ DE YAKBOT*

🎴 *GACHA & RPG*

${prefix}rw
> Tira un personaje aleatorio (15 min CD).

${prefix}c
> Reclama el personaje (20 min CD).

${prefix}harem [n]
> Tu colección (ordenada por valor, 20 por página).

${prefix}wtired [n]
> Estado de energía y cansancio de tu harem.

${prefix}charinfo [Nombre]
> Stats detallados: Nivel, EXP y Poder Real.

${prefix}wimage [Nombre]
> Muestra la imagen de un personaje de tu harem.

${prefix}charlist [Fuente]
> Lista de personajes disponibles por serie.

${prefix}givechar @usuario [Nombre]
> Regala un personaje de tu harem.

${prefix}trade @usuario [MiChar] | [SuChar]
> Intercambio de personajes.

${prefix}cooldowns
> Consulta tus tiempos de espera.


⚔️ *PVP 3v3 (NIVELES)*

${prefix}duel @usuario
> Reta a alguien (5 min para aceptar).

${prefix}accept
> Acepta el duelo pendiente.

${prefix}pick [char1, char2, char3]
> Elige equipo. ¡Los niveles aumentan tu poder!


💰 *ECONOMÍA & TIENDAS*

${prefix}w
> Trabaja para ganar dinero (1 min CD).

${prefix}crime
> Intenta un crimen (5 min CD).

${prefix}daily
> Recompensa diaria (Reset 9 PM).

${prefix}bal
> Consulta tu dinero actual.

${prefix}baltop
> Ranking de millonarios del grupo.

${prefix}pay [cantidad] @usuario
> Transfiere dinero a otro usuario.

${prefix}charshop
> Mercado rotativo de personajes nuevos.

${prefix}bchar [número]
> Compra un personaje del mercado.

${prefix}shop
> Tienda de objetos (Pociones, XP, Evolución).

${prefix}buy [número] [nombre]
> Compra y usa un objeto en un personaje.


🎬 *REACCIONES ANIME*

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
⌁ ${prefix}dance
    ╰┈─ ➤ Echarse unos pasos.
⌁ ${prefix}scared
    ╰┈─ ➤ ¡Qué miedo!
⌁ ${prefix}eat
    ╰┈─ ➤ Hora de la comida.
⌁ ${prefix}sleep
    ╰┈─ ➤ Irse a dormir.
⌁ ${prefix}cafe
    ╰┈─ ➤ Tomar un cafecito.
⌁ ${prefix}hug @usuario
    ╰┈─ ➤ Dar un abrazo.
⌁ ${prefix}kiss @usuario
    ╰┈─ ➤ Dar un beso.


🖼 *STICKERS*

${prefix}s
> Convierte imagen, GIF o video en sticker.


⚙️ *ADMIN & OTROS*

${prefix}reload
> Reinicia el bot (Solo dueño).
${prefix}tr
> Traduce un texto.

${prefix}ping | ${prefix}info | ${prefix}creador`;

            return message.reply(menuText);
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

    if (comando === 'ping') {
        return message.reply('🏓 Pong! Estoy activo.');
    }

// --- COMANDO POKEVO REPARADO ---
    if (comando === 'pokevo') {
        const args = message.body.split(/\s+/).slice(1);
        const target = args.join(' ').toLowerCase().trim();
        const chat = await message.getChat();
        const grupoId = chat.id._serialized;
        const senderId = message.author || message.from; // Usa el ID correcto del remitente

        if (!target) return message.reply(`❌ Uso: ${prefix}pokevo [nombre del personaje]`);

        // 1. Verificar si existe la base de datos de harems
        if (!haremPorGrupo[grupoId] || !haremPorGrupo[grupoId][senderId]) {
            return message.reply("❌ No tienes personajes en tu harem de este grupo.");
        }

        const userHarem = haremPorGrupo[grupoId][senderId];

        // 2. Buscar al personaje en el harem del usuario (ignorando tildes y mayúsculas)
        const index = userHarem.findIndex(p => p.nombre.toLowerCase() === target);
        
        if (index === -1) {
            return message.reply(`❌ No tienes a **${target}** en tu lista.`);
        }

        const pjEnHarem = userHarem[index];

        // 3. Buscar la data base original en personajes.json para ver si evoluciona
        const dataBase = personajes.find(p => p.nombre.toLowerCase() === pjEnHarem.nombre.toLowerCase());

        if (!dataBase || !dataBase.evolucion) {
            return message.reply(`❌ **${pjEnHarem.nombre}** no tiene evoluciones registradas.`);
        }

        // 4. Verificar nivel (si no tiene nivel, asumimos que puede evolucionar para no trabar el bot)
        const nivelActual = pjEnHarem.level || pjEnHarem.nivel || 1; 
        const nivelRequerido = dataBase.nivelEvo || 1;

        if (nivelActual < nivelRequerido) {
            return message.reply(`⌛ Nivel insuficiente. **${pjEnHarem.nombre}** necesita nivel ${nivelRequerido} (Actual: ${nivelActual}).`);
        }

        // 5. Buscar los datos de la nueva forma
        const evoData = personajes.find(p => p.nombre.toLowerCase() === dataBase.evolucion.toLowerCase());

        if (!evoData) {
            return message.reply(`❌ Error: No se encontró la data de **${dataBase.evolucion}** en el archivo personajes.json.`);
        }

        // 6. EVOLUCIONAR
        const nombreViejo = pjEnHarem.nombre;
        
        // Actualizamos los datos manteniendo el nivel que ya tenía
        userHarem[index] = {
            ...pjEnHarem, // Mantiene nivel, experiencia, etc.
            nombre: evoData.nombre,
            imagen: evoData.image || evoData.imagen, // Soporte para ambos nombres de propiedad
            valor: evoData.valor
        };

        // 7. Guardar y confirmar
        haremPorGrupo[grupoId][senderId] = userHarem;
        guardarHarem(haremPorGrupo);

        return message.reply(`✨ ¡Felicidades! Tu **${nombreViejo}** ha evolucionado a **${evoData.nombre}**! 🎉`);
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


if (comando === 'cooldowns') {

    const ahora = Date.now();
    let texto = "◔ Tus cooldowns activos:\n\n";

    if (cooldownsRW[grupoId]?.[userId]) {
        const total = 15 * 60 * 1000;
        const restante = total - (ahora - cooldownsRW[grupoId][userId]);
        if (restante > 0)
            texto += `◔ rw → ${msToTime(restante)}\n`;
    }

    if (cooldownsC[grupoId]?.[userId]) {
        const total = 20 * 60 * 1000;
        const restante = total - (ahora - cooldownsC[grupoId][userId]);
        if (restante > 0)
            texto += `◔ c → ${msToTime(restante)}\n`;
    }

    const economia = cargarEconomia();
    asegurarUsuario(economia, userId);

    const totalW = 60 * 1000;
    const restanteW = totalW - (ahora - economia[userId].lastWork);
    if (restanteW > 0)
        texto += `◔ w → ${msToTime(restanteW)}\n`;

    const totalCrime = 5 * 60 * 1000;
    const restanteCrime = totalCrime - (ahora - economia[userId].lastCrime);
    if (restanteCrime > 0)
        texto += `◔ crime → ${msToTime(restanteCrime)}\n`;

    if (texto === "◔ Tus cooldowns activos:\n\n")
        texto += "◔ No tienes cooldowns activos.";

    return message.reply(texto);
}


if (message.body === "?w") {

    const economia = cargarEconomia();
    const userId = message.author || message._data.participant || message.from;

    asegurarUsuario(economia, userId);

    const ahora = Date.now();
    const cooldown = 60 * 1000; // 1 minuto

if (ahora - economia[userId].lastWork < cooldown) {
    const restante = cooldown - (ahora - economia[userId].lastWork);
    return message.reply(`◔ Espera ${msToTime(restante)} para volver a trabajar`);
}

    const ganancia = Math.floor(Math.random() * 401) + 100;
    economia[userId].dinero += ganancia;
    economia[userId].lastWork = ahora;

    guardarEconomia(economia);

    message.reply(`⌨ Trabajaste y ganaste $${ganancia}\n\n» Balance: $${economia[userId].dinero}`);
}

if (message.body === "?crime") {

    const economia = cargarEconomia();
    const userId = message.author || message._data.participant || message.from;

    asegurarUsuario(economia, userId);

    const ahora = Date.now();
    const cooldown = 5 * 60 * 1000; // 5 minutos

if (ahora - economia[userId].lastCrime < cooldown) {
    const restante = cooldown - (ahora - economia[userId].lastCrime);
    return message.reply(`◔ Espera ${msToTime(restante)} para volver a intentar cometer un crimen`);
}

    const exito = Math.random() < 0.5;

    if (exito) {
        const ganancia = Math.floor(Math.random() * 901) + 300;
        economia[userId].dinero += ganancia;

        message.reply(`✪ Crimen exitoso...\nGanaste $${ganancia}\n\n» Balance: $${economia[userId].dinero}`);
    } else {
        const perdida = Math.floor(Math.random() * 601) + 200;
        economia[userId].dinero -= perdida;
        if (economia[userId].dinero < 0) economia[userId].dinero = 0;

        message.reply(`✪ Te atraparon...\nPerdiste $${perdida}\n\n» Balance: $${economia[userId].dinero}`);
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
    const premio = 50000; // Ajusta el premio a tu gusto
    economia[userId].dinero += premio;
    economia[userId].lastDaily = ahora.getTime();

    guardarEconomia(economia);

    return message.reply(`🎁 *RECOMPENSA DIARIA*\n\nHas recibido *$${premio.toLocaleString()}*.\n¡Vuelve después de las 9:00 PM para tu siguiente regalo!`);
}

if (message.body === "?bal") {

    const economia = cargarEconomia();
    const userId = message.author || message._data.participant || message.from;

    asegurarUsuario(economia, userId);

    message.reply(`» Tu balance actual es: $${economia[userId].dinero}`);
}

// ==========================================
//           SISTEMA DE TIENDA (SHOP)
// ==========================================

// --------- COMANDO ?shop ---------
if (comando === 'shop') {
    const economia = cargarEconomia();
    asegurarUsuario(economia, userId);
    
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
    tabla += `⌬ Tu Balance: *$${economia[userId].dinero.toLocaleString()}*`;
    
    return message.reply(tabla);
}

// --------- COMANDO ?buy ---------
if (comando.startsWith('buy')) {
    const economia = cargarEconomia();
    asegurarUsuario(economia, userId);
    
    const args = message.body.slice(prefix.length + 3).trim().split(/\s+/);
    const itemNum = args[0];
    const nombreChar = args.slice(1).join(" ");

    if (!itemNum || !nombreChar) {
        return message.reply(`❌ Uso correcto: *${prefix}buy [número] [nombre del personaje]*\nEjemplo: *${prefix}buy 1 Goku*`);
    }

    const personajesUsuario = haremPorGrupo[grupoId]?.[userId] || [];
    const personaje = personajesUsuario.find(p => p.nombre.toLowerCase() === nombreChar.toLowerCase());
if (!personaje) return message.reply("No tienes ese personaje en tu harem.");

    // --- PARCHE DE EMERGENCIA PARA NaN ---
    if (isNaN(personaje.level) || !personaje.level) personaje.level = 1;
    if (isNaN(personaje.exp) || !personaje.exp) personaje.exp = 0;
    if (isNaN(personaje.stamina) || !personaje.stamina) personaje.stamina = 100;

    if (!personaje) return message.reply("No tienes ese personaje en tu harem.");

    // --- LÓGICA DE COMPRA ---

    if (itemNum === '1') { // POCIÓN
        if (economia[userId].dinero < 15000) return message.reply("No tienes suficiente dinero ($15,000).");
        economia[userId].dinero -= 15000;
        personaje.stamina = Math.min(100, (personaje.stamina || 0) + 50);
        personaje.lastUpdate = Date.now();
        message.reply(`🧪 *Poción* usada en ${personaje.nombre}.\n⚡ Stamina: ${personaje.stamina}%`);
    } 
    
    else if (itemNum === '2') { // AMULETO XP
        if (economia[userId].dinero < 35000) return message.reply("No tienes suficiente dinero ($35,000).");
        economia[userId].dinero -= 35000;
        personaje.exp += 100;
        
        // Requisito escalable del 10% que configuramos
        let xpReq = Math.floor(100 * Math.pow(1.1, personaje.level - 1));
        let subio = false;
        if (personaje.exp >= xpReq) {
            personaje.level += 1;
            personaje.exp = 0;
            subio = true;
        }
        message.reply(`✨ *Amuleto* usado en ${personaje.nombre}.${subio ? ' \n🆙 ¡SUBIÓ AL NIVEL ' + personaje.level + '!' : ''}`);
    }

    else if (itemNum === '3') { // PIEDRA EVOLUCIÓN
        if (economia[userId].dinero < 80000) return message.reply("No tienes suficiente dinero ($80,000).");
        economia[userId].dinero -= 80000;
        personaje.level += 1;
        message.reply(`⭐ ¡${personaje.nombre} ha evolucionado al nivel ${personaje.level}!`);
    }

    else if (itemNum === '4') { // BENDICIÓN
        if (economia[userId].dinero < 150000) return message.reply("No tienes suficiente dinero ($150,000).");
        economia[userId].dinero -= 150000;
        personaje.stamina = 100;
        personaje.level += 2;
        message.reply(`💖 ¡${personaje.nombre} ha sido bendecido!\n🆙 +2 Niveles (Nivel actual: ${personaje.level})\n⚡ Energía al 100%`);
    }

    else if (itemNum === '5') { // CONTRATO ETERNO
        if (economia[userId].dinero < 300000) return message.reply("No tienes suficiente dinero ($300,000).");
        economia[userId].dinero -= 300000;
        personaje.valor = Math.floor(personaje.valor * 1.5);
        message.reply(`📜 *Contrato Eterno* firmado.\n📈 El valor base de ${personaje.nombre} ha subido permanentemente a $${personaje.valor.toLocaleString()}.`);
    }

    else {
        return message.reply("Dou! Ese número de objeto no existe en la tienda.");
    }

    // Guardar cambios en ambos archivos
    guardarEconomia(economia);
    guardarHarem(haremPorGrupo);
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
            msg += `*${i + 1}*\n`; // El número solo
            msg += `╰┈─ ➤ *Personaje:* ${p.nombre}\n`;
            msg += `╰┈─ ➤ *Anime:* ${p.fuente}\n`;
            msg += `╰┈─ ➤ *Costo:* $${p.precio.toLocaleString()}\n`;
            msg += `╰┈─ ➤ *Comprar:* \`?bchar ${i + 1}\`\n\n`;
        });
    }

    const economia = cargarEconomia();
    const saldo = economia[userId] ? (economia[userId].dinero || 0) : 0;
    msg += `━━━━━━━━━━━━━━━━━━━━\n⌬ Tu Saldo: *$${saldo.toLocaleString()}*`;
    
    return message.reply(msg);
}

if (comando.startsWith('bchar')) {
        actualizarCharShop(grupoId);
        const shopDelGrupo = charShopsPorGrupo[grupoId];
        
        // Separamos por espacios y agarramos el segundo elemento (el número)
        const argsB = message.body.trim().split(/\s+/);
        const numeroInput = parseInt(argsB[1]);
        const indice = numeroInput - 1;

        console.log(`[DEBUG] Intentando compra: Usuario ${userId}, Número ${numeroInput}`);

        if (isNaN(numeroInput) || !shopDelGrupo || !shopDelGrupo.personajes[indice]) {
            return message.reply("❌ Número inválido. Usa: `?bchar [número]` (Mira los números en `?charshop`)");
        }

        const item = shopDelGrupo.personajes[indice];
        const economia = cargarEconomia();
        
        if (!economia[userId]) economia[userId] = { dinero: 0 };
        const dineroUsuario = economia[userId].dinero || 0;

        if (dineroUsuario < item.precio) {
            const falta = item.precio - dineroUsuario;
            return message.reply(`❌ No tienes suficiente dinero.\n💰 Precio: *$${item.precio.toLocaleString()}*\n💵 Tienes: *$${dineroUsuario.toLocaleString()}*\n📉 Te faltan: *$${falta.toLocaleString()}*`);
        }

        // Inicializar Harem si no existe
        if (!haremPorGrupo[grupoId]) haremPorGrupo[grupoId] = {};
        if (!haremPorGrupo[grupoId][userId]) haremPorGrupo[grupoId][userId] = [];

        try {
            // TRANSACCIÓN
            economia[userId].dinero -= item.precio;

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

            // Guardar en memoria
            haremPorGrupo[grupoId][userId].push(nuevoPersonaje);
            
            // Quitar de la tienda
            shopDelGrupo.personajes.splice(indice, 1);

            // Guardar en archivos JSON
            guardarEconomia(economia);
            guardarHarem(haremPorGrupo);

            console.log(`[SUCCESS] ${item.nombre} comprado por ${userId}`);
            return message.reply(`🎉 ¡COMPRA EXITOSA!\n\nHas adquirido a: *${item.nombre}*\nFuente: _${item.fuente}_\n💰 Saldo restante: *$${economia[userId].dinero.toLocaleString()}*`);
            
        } catch (e) {
            console.log("Error crítico en bchar:", e);
            return message.reply("⚠️ Error al procesar la base de datos.");
        }
    }

if (message.body === "?baltop") {

    if (!message.from.endsWith("@g.us")) {
        return message.reply("Este comando solo funciona en grupos.");
    }

    const economia = cargarEconomia();
    const chat = await message.getChat();
    const participantes = chat.participants.map(p => p.id._serialized);

    let ranking = [];

    participantes.forEach(id => {
        if (economia[id]) {
            ranking.push({
                id: id,
                dinero: economia[id].dinero
            });
        }
    });

    ranking.sort((a, b) => b.dinero - a.dinero);

    let texto = "❏ TOP DINERO \n\n";

    ranking.slice(0, 10).forEach((user, index) => {
        texto += `${index + 1}. $${user.dinero}\n`;
    });

    message.reply(texto);
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
    if (!duelosActivos[grupoId]) return;
    const duelo = duelosActivos[grupoId];
    if (userId !== duelo.jugador1 && userId !== duelo.jugador2) return;

    const textoOriginal = message.body.slice(prefix.length + 5).trim();
    const nombres = textoOriginal.split(",").map(n => n.trim());

    if (nombres.length < 1 || nombres.length > 3) {
        return message.reply("Debes elegir entre 1 y 3 personajes separados por coma.");
    }
    if (!haremPorGrupo[grupoId] || !haremPorGrupo[grupoId][userId]) {
        return message.reply("No tienes personajes.");
    }

    let equipo = [];
    let valorTotal = 0;
    let tieneADeadpool = false; // Check para el diálogo

    for (let nombre of nombres) {
        const personaje = haremPorGrupo[grupoId][userId]
            .find(p => p.nombre.toLowerCase() === nombre.toLowerCase());

        if (!personaje) {
            return message.reply(`No tienes a ${nombre}.`);
        }

        // --- LÓGICA DEADPOOL: STAMINA ---
        actualizarStamina(personaje);
        
        if (personaje.nombre === 'Deadpool') {
            tieneADeadpool = true;
            personaje.stamina = 100; // Deadpool nunca se cansa (Factor de curación)
        } else if (personaje.stamina <= 10) {
            return message.reply(`Noup, ${personaje.nombre} está muy cansado (${personaje.stamina}%). ¡Déjalo dormir!`);
        }

        // Calcular valor real
        let valorReal = Number(personaje.valor) * Math.pow(1.20, (personaje.level - 1));

        // --- LÓGICA DEADPOOL: TRAMPA DE VALOR ---
        if (personaje.nombre === 'Deadpool') {
            // 20% de probabilidad de que su valor sea absurdamente alto por "guion"
            if (Math.random() < 0.20) {
                valorReal *= 5; 
                message.reply("🔴 *DEADPOOL:* ¡Le robé el teclado al programador y me subí las stats! ¡Miren ese poder! 💥");
            }
        }

        valorTotal += valorReal; 

        // Restar energía (Excepto a Deadpool)
        if (personaje.nombre !== 'Deadpool') {
            personaje.stamina -= 30; 
            if (personaje.stamina < 0) personaje.stamina = 0;
            personaje.lastUpdate = Date.now();
        }

        if (equipo.find(p => p.nombre === personaje.nombre)) {
            return message.reply("No puedes repetir personajes.");
        }

        equipo.push(personaje);
    }

    duelo.picks[userId] = { equipo, valorTotal };
    
    let msgConfirm = "Equipo seleccionado.";
    if (tieneADeadpool) msgConfirm = "Equipo seleccionado. 🔴 *DP:* ¡Prepárense para la masacre! Traje chimichangas para todos (menos para los perdedores).";
    message.reply(msgConfirm);

    // Si ambos ya eligieron
    if (duelo.picks[duelo.jugador1] && duelo.picks[duelo.jugador2]) {
        clearTimeout(duelo.timeoutPick);

        const equipo1 = duelo.picks[duelo.jugador1];
        const equipo2 = duelo.picks[duelo.jugador2];

        // RNG leve ±5%
        let poder1 = equipo1.valorTotal * (0.95 + Math.random() * 0.1);
        let poder2 = equipo2.valorTotal * (0.95 + Math.random() * 0.1);

        // --- LÓGICA DEADPOOL: VICTORIA FORZADA ---
        // Si alguien tiene a Deadpool, hay un 10% de probabilidad extra de ganar por "Deus Ex Machina"
        if (equipo1.equipo.some(p => p.nombre === 'Deadpool') && Math.random() < 0.10) {
            poder1 += poder2; 
            message.reply("🔴 *DEADPOOL:* ¿Iba perdiendo? ¡JA! Eso era un señuelo de cartón, el verdadero yo acaba de apuñalar al otro equipo por la espalda. ¡Ganamos!");
        } else if (equipo2.equipo.some(p => p.nombre === 'Deadpool') && Math.random() < 0.10) {
            poder2 += poder1;
            message.reply("🔴 *DEADPOOL:* ¡BOOM! Puse C4 en las estadísticas del oponente. ¡Victoria para mi dueño!");
        }

        const economia = cargarEconomia();
        asegurarUsuario(economia, duelo.jugador1);
        asegurarUsuario(economia, duelo.jugador2);

        let mensajeFinal = "";
        const ganadorId = poder1 > poder2 ? duelo.jugador1 : duelo.jugador2;
        const perdedorId = poder1 > poder2 ? duelo.jugador2 : duelo.jugador1;
        const robo = Math.floor(economia[perdedorId].dinero * 0.50);

        economia[perdedorId].dinero -= robo;
        economia[ganadorId].dinero += robo;

        mensajeFinal = `⇏ RESULTADO 3v3 ⇍\n\n`;
        mensajeFinal += `Equipo 1 (${duelo.jugador1.split('@')[0]}):\n${equipo1.equipo.map(p => p.nombre).join(", ")}\nTotal: ${Math.floor(equipo1.valorTotal)}\n\n`;
        mensajeFinal += `Equipo 2 (${duelo.jugador2.split('@')[0]}):\n${equipo2.equipo.map(p => p.nombre).join(", ")}\nTotal: ${Math.floor(equipo2.valorTotal)}\n\n`;
        mensajeFinal += `» GANADOR: @${ganadorId.split('@')[0]}\n» Robó $${robo.toLocaleString()}`;

        // --- FRASES DE CIERRE DE DEADPOOL ---
        const equipoGanador = poder1 > poder2 ? equipo1 : equipo2;
        if (equipoGanador.equipo.some(p => p.nombre === 'Deadpool')) {
            mensajeFinal += `\n\n🔴 *DEADPOOL:* ¡Victoria! Ahora vámonos antes de que el dueño del bot se de cuenta de que hice trampa. 🌮`;
        }

        // Ganadores y Perdedores ganan XP (Tu lógica de XP se mantiene igual)
        const ganadoresP = equipoGanador.equipo;
        const perdedoresP = poder1 > poder2 ? equipo2.equipo : equipo1.equipo;

        ganadoresP.forEach(p => {
            p.exp += 50; 
            let xpReq = Math.floor(100 * Math.pow(1.1, p.level - 1));
            if (p.exp >= xpReq) { p.level += 1; p.exp = 0; }
        });

        perdedoresP.forEach(p => {
            p.exp += 15; 
            let xpReq = Math.floor(100 * Math.pow(1.1, p.level - 1));
            if (p.exp >= xpReq) { p.level += 1; p.exp = 0; }
        });

        guardarEconomia(economia);
        guardarHarem(haremPorGrupo);

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
if (comando.startsWith('harem')) {
    if (!haremPorGrupo[grupoId] || !haremPorGrupo[grupoId][userId] || haremPorGrupo[grupoId][userId].length === 0) {
        return message.reply('❒ Tu harem está vacío.');
    }

    const argsH = message.body.slice(prefix.length + 5).trim().split(/\s+/);
    let pagina = parseInt(argsH[0]) || 1; 
    const personajesPorPagina = 20;

    let listaOrdenada = [...haremPorGrupo[grupoId][userId]];
    listaOrdenada.sort((a, b) => {
        const vA = Math.floor(Number(a.valor) * Math.pow(1.20, (a.level || 1) - 1));
        const vB = Math.floor(Number(b.valor) * Math.pow(1.20, (b.level || 1) - 1));
        return vB - vA;
    });

    const totalPaginas = Math.ceil(listaOrdenada.length / personajesPorPagina);
    if (pagina < 1) pagina = 1;
    if (pagina > totalPaginas) pagina = totalPaginas;

    const inicio = (pagina - 1) * personajesPorPagina;
    const fin = inicio + personajesPorPagina;
    const personajesPagina = listaOrdenada.slice(inicio, fin);

    let respuesta = `༺ ${message._data.notifyName.toUpperCase()} ༻\n`;
    respuesta += `━━━━━━━━━━━━━━━━━━━━\n`;
    respuesta += `          ᴘᴀ́ɢɪɴᴀ ${pagina} ᴅᴇ ${totalPaginas}\n\n`;

    personajesPagina.forEach((p, index) => {
        const valorReal = Math.floor(Number(p.valor) * Math.pow(1.20, (p.level || 1) - 1));
        let numGlobal = (inicio + index + 1).toString().padStart(2, '0');
        
        if (p.nombre === 'Deadpool') {
            respuesta += `⌁ ${numGlobal} ⌁ 🔴 *DEADPOOL*\n`;
            respuesta += `    ╰┈─ ➤ Marvel ✦ (Está rompiendo tu lista de personajes)\n\n`;
        } else {
            respuesta += `⌁ ${numGlobal} ⌁ ${p.nombre}\n`;
            respuesta += `    ╰┈─ ➤ ${p.fuente} ✦ ${valorReal.toLocaleString()}\n\n`;
        }
    });

    respuesta += `━━━━━━━━━━━━━━━━━━━━\n`;
    respuesta += `⌬ Total: ${listaOrdenada.length} ⌁ Paginas: ${totalPaginas}\n`;
    respuesta += `⌬ Usa: ?harem [número]`;

    return message.reply(respuesta);
}

if (comando.startsWith('wimage')) {
        const args = message.body.split(/\s+/).slice(1);
        const nombreBusqueda = args.join(" ").toLowerCase().trim();

        if (!nombreBusqueda) {
            return message.reply("❌ Uso: `?wimage [nombre]`\nEjemplo: `?wimage goku`.");
        }

        // Buscamos en la base de datos global 'personajes'
        const pj = personajes.find(p => p.nombre.toLowerCase().includes(nombreBusqueda));

        if (!pj) {
            return message.reply(`❌ No encontré a "${nombreBusqueda}" en la base de datos.`);
        }

        try {
            // Intentamos obtener la imagen
            const media = await MessageMedia.fromUrl(pj.imagen).catch(() => null);

            const caption = `🖼️ *PERSONAJE ENCONTRADO*\n\n` +
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

// --------- ?charinfo ---------

if (comando.startsWith('charinfo')) {
    // 1. Extraer el nombre correctamente
    const nombreBusqueda = message.body.slice(prefix.length + 8).trim(); 
    
    if (!nombreBusqueda) return message.reply("❌ Escribe el nombre del personaje.\nEjemplo: `?charinfo Goku`.");

    if (!haremPorGrupo[grupoId] || !haremPorGrupo[grupoId][userId]) {
        return message.reply("❒ Tu harem está vacío.");
    }

    const personaje = haremPorGrupo[grupoId][userId].find(p => p.nombre.toLowerCase() === nombreBusqueda.toLowerCase());

    if (!personaje) return message.reply(`❌ No tienes a "${nombreBusqueda}" en tu colección.`);

    // 2. Asegurar que los stats existan (por si es un personaje viejo)
    if (personaje.level === undefined) personaje.level = 1;
    if (personaje.exp === undefined) personaje.exp = 0;

    // 3. Cálculos de XP y Poder
    const xpSiguienteNivel = Math.floor(100 * Math.pow(1.1, personaje.level - 1));
    const poderReal = Math.floor(Number(personaje.valor) * Math.pow(1.20, (personaje.level - 1)));

    let infoMsg = `👤 *DETALLES DEL PERSONAJE*\n`;
    infoMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    infoMsg += `⭐ *Nombre:* ${personaje.nombre}\n`;
    infoMsg += `🎬 *Serie:* ${personaje.fuente}\n`;
    infoMsg += `📊 *Nivel:* ${personaje.level}\n`;
    infoMsg += `✨ *XP:* ${personaje.exp} / ${xpSiguienteNivel}\n`;
    infoMsg += `⚔️ *Poder Real:* ${poderReal.toLocaleString()}\n`;
    infoMsg += `⚡ *Energía:* ${personaje.stamina || 100}%\n\n`;
    infoMsg += `━━━━━━━━━━━━━━━━━━━━`;

    try {
        const response = await fetch(personaje.imagen);
        const buffer = Buffer.from(await response.arrayBuffer());
        const media = new MessageMedia('image/jpeg', buffer.toString('base64'), 'char.jpg');
        
        await client.sendMessage(message.from, media, { caption: infoMsg });
    } catch (error) {
        console.log("Error cargando imagen en charinfo:", error.message);
        message.reply(infoMsg); // Si falla la imagen, envía al menos el texto
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

// --------- COMANDO ?ship (MEDIDOR DE AMOR) ---------
if (comando.startsWith('ship')) {
    const chat = await message.getChat();
    const participants = chat.isGroup ? chat.participants : [];
    let user1, user2;

    const mentions = await message.getMentions();

    if (mentions.length >= 2) {
        // CASO 1: Mencionaste a dos personas
        user1 = mentions[0];
        user2 = mentions[1];
    } else if (mentions.length === 1) {
        // CASO 2: Mencionaste a uno, el bot elige al otro al azar
        user1 = mentions[0];
        if (chat.isGroup) {
            const randomUser = participants[Math.floor(Math.random() * participants.length)];
            user2 = await client.getContactById(randomUser.id._serialized);
        } else {
            return message.reply("❏ *Error:* En chat privado debes mencionar a dos personas.");
        }
    } else {
        // CASO 3: No mencionaste a nadie, azar total (solo en grupos)
        if (!chat.isGroup) return message.reply("❏ *Error:* Menciona a alguien o úsalo en un grupo.");
        
        const r1 = participants[Math.floor(Math.random() * participants.length)];
        const r2 = participants[Math.floor(Math.random() * participants.length)];
        user1 = await client.getContactById(r1.id._serialized);
        user2 = await client.getContactById(r2.id._serialized);
    }

    // Evitar que se shippee consigo mismo
    if (user1.id._serialized === user2.id._serialized) {
        return message.reply("❏ *Error:* El amor propio es importante, pero intenta con alguien más.");
    }

    const porcentaje = Math.floor(Math.random() * 101);
    const nombre1 = user1.pushname || "Usuario 1";
    const nombre2 = user2.pushname || "Usuario 2";

    let barra = "▱▱▱▱▱▱▱▱▱▱";
    const llenos = Math.round(porcentaje / 10);
    barra = "▰".repeat(llenos) + "▱".repeat(10 - llenos);

    let shipMsg = `
『  *MEDIDOR DE COMPATIBILIDAD* 』

↳ [ ${nombre1} ]
↳ [ ${nombre2} ]

❏ *PORCENTAJE:* [ ${porcentaje}% ]
↳ [ ${barra} ]

${porcentaje > 80 ? '↳ Nivel: Destinados a estar juntos.' : 
  porcentaje > 50 ? '↳ Nivel: Hay química aquí.' : 
  porcentaje > 20 ? '↳ Nivel: Podrían ser amigos.' : 
  '↳ Nivel: Muy bajo. Ni se miren.'}
`;

    return message.reply(shipMsg);
}

// --------- ?givechar ---------

if (comando.startsWith('givechar')) {

    if (!message.from.endsWith("@g.us")) {
        return message.reply("Solo funciona en grupos.");
    }

    const mentioned = message.mentionedIds[0];
    if (!mentioned) {
        return message.reply("Debes mencionar a alguien.");
    }

    const args = message.body.split(" ");
    if (args.length < 3) {
        return message.reply("Uso: ?givechar @usuario NombreDelPersonaje");
    }

    const nombre = args.slice(2).join(" ");

    if (!haremPorGrupo[grupoId] ||
        !haremPorGrupo[grupoId][userId] ||
        !haremPorGrupo[grupoId][userId].find(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {

        return message.reply("No tienes ese personaje.");
    }

    const personaje = haremPorGrupo[grupoId][userId]
        .find(p => p.nombre.toLowerCase() === nombre.toLowerCase());

    // Quitar del iniciador
    haremPorGrupo[grupoId][userId] =
        haremPorGrupo[grupoId][userId].filter(p => p.nombre !== personaje.nombre);

    // Agregar al receptor
    if (!haremPorGrupo[grupoId][mentioned]) {
        haremPorGrupo[grupoId][mentioned] = [];
    }

    haremPorGrupo[grupoId][mentioned].push(personaje);

    guardarHarem(haremPorGrupo);

    message.reply(`◇ ${personaje.nombre} fue regalado correctamente.`);

// Dentro de ?givechar o ?trade, después de encontrar 'personaje'
if (personaje.nombre === "♛ PERSONAJE DEL ADMIN ♛") {
    return message.reply("🔒 Este personaje está vinculado a tu alma. No puede ser transferido ni tradeado.");
}

}


if (message.body.startsWith(prefix + 'yt ')) {
    const query = message.body.slice(prefix.length + 3).trim();
    if (!query) return message.reply("❌ Uso: `?yt [nombre o link]`");

    try {
        // 1. Buscamos el video para tener la URL y el título
        const r = await yts(query);
        const video = r.videos[0];
        if (!video) return message.reply("❌ No encontré el video.");

        message.reply(`⏳ Bajando *${video.title}* de servidores externos...`);

        // 2. Usamos una API que no depende de tu IP local
        // He seleccionado una que suele ser muy estable para bots
        const apiUrl = `https://api.lolhuman.xyz/api/ytvideo2?apikey=GataDios&url=${url})}`;
        
        const res = await axios.get(apiUrl);
        
        if (!res.data || !res.data.download_url) {
            return message.reply("⚠️ Los servidores externos de YouTube están saturados. Intenta en un momento.");
        }

        const downloadUrl = res.data.download_url;
        const tempFile = path.resolve(__dirname, `video_${Date.now()}.mp4`);

        // 3. Descargamos el archivo que la API ya procesó por nosotros
        const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(tempFile);
        response.data.pipe(writer);

        writer.on('finish', async () => {
            try {
                // Verificamos que el archivo no esté vacío
                if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 0) {
                    const media = MessageMedia.fromFilePath(tempFile);
                    await client.sendMessage(message.from, media, { 
                        caption: `🎬 *${video.title}*\n🔗 ${video.url}` 
                    });
                } else {
                    message.reply("❌ El servidor externo entregó un archivo vacío.");
                }
            } catch (e) {
                console.error("Error al enviar WA:", e);
                message.reply("❌ WhatsApp no pudo procesar el archivo enviado por el servidor.");
            } finally {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            }
        });

    } catch (err) {
        console.error("Error en API:", err);
        message.reply("⚠️ Error crítico en el servidor de descarga. YouTube ha bloqueado incluso esta ruta.");
    }
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
if (comando.startsWith('trade')) {
    if (!message.from.endsWith("@g.us")) return message.reply("Solo en grupos.");
    if (tradesPendientes[grupoId]) return message.reply("Ya hay un trade pendiente aquí.");

    const mentioned = message.mentionedIds[0];
    if (!mentioned) return message.reply("Debes mencionar a alguien.");

    // Limpiamos el texto para sacar solo los nombres de los personajes
    const textoSinComando = message.body.slice(prefix.length + 5).trim(); 
    const partes = textoSinComando.split("|");

    if (partes.length !== 2) {
        return message.reply("Uso: ?trade @usuario MiPersonaje | SuPersonaje");
    }

    // Limpiamos menciones y espacios de los nombres
    const miNombre = partes[0].replace(/@\d+\s*/g, "").trim();
    const suNombre = partes[1].trim();

    if (!haremPorGrupo[grupoId]?.[userId]) return message.reply("No tienes personajes.");

    const miPersonaje = haremPorGrupo[grupoId][userId].find(p => p.nombre.toLowerCase() === miNombre.toLowerCase());
    const suPersonaje = haremPorGrupo[grupoId][mentioned]?.find(p => p.nombre.toLowerCase() === suNombre.toLowerCase());

    if (!miPersonaje) return message.reply(`No tienes a "${miNombre}" en tu harem.`);
    if (!suPersonaje) return message.reply(`Esa persona no tiene a "${suNombre}".`);

    tradesPendientes[grupoId] = {
        iniciador: userId,
        receptor: mentioned,
        miPersonaje,
        suPersonaje,
        timeout: setTimeout(() => { delete tradesPendientes[grupoId]; }, 60000)
    };

    const contactReceptor = await client.getContactById(mentioned);
    return client.sendMessage(message.from, 
        `🔄 *PROPUESTA DE INTERCAMBIO*\n\n` +
        `@${userId.split('@')[0]} ofrece: *${miPersonaje.nombre}*\n` +
        `@${mentioned.split('@')[0]} ofrece: *${suPersonaje.nombre}*\n\n` +
        `✅ @${mentioned.split('@')[0]}, responde *aceptar* en 60s.`,
        { mentions: [userId, mentioned] }
    );
}

// --------- Confirmar Trade ---------
if (texto === "aceptar") {
    const trade = tradesPendientes[grupoId];
    if (!trade || userId !== trade.receptor) return;

    clearTimeout(trade.timeout);

    // 1. Quitar personajes de sus dueños originales
    haremPorGrupo[grupoId][trade.iniciador] = haremPorGrupo[grupoId][trade.iniciador]
        .filter(p => p.nombre !== trade.miPersonaje.nombre);

    haremPorGrupo[grupoId][trade.receptor] = haremPorGrupo[grupoId][trade.receptor]
        .filter(p => p.nombre !== trade.suPersonaje.nombre);

    // 2. Entregar personajes (Intercambio)
    haremPorGrupo[grupoId][trade.iniciador].push(trade.suPersonaje);
    haremPorGrupo[grupoId][trade.receptor].push(trade.miPersonaje);

    // 3. ¡MUY IMPORTANTE! Guardar en el archivo JSON
    guardarHarem(haremPorGrupo);

    delete tradesPendientes[grupoId];

    return message.reply(`🔁 ¡Intercambio exitoso!\n\n*${trade.miPersonaje.nombre}* ⇋ *${trade.suPersonaje.nombre}*`);
}

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

if (comando === 'smob') {
    const ahora = Date.now();
    const tiempoEspera = 15 * 60 * 1000; // 15 minutos

    // Verificar cooldown en memoria
    if (cooldownsBuscarmob[userId] && ahora - cooldownsBuscarmob[userId] < tiempoEspera) {
        const restante = Math.ceil((tiempoEspera - (ahora - cooldownsBuscarmob[userId])) / 1000 / 60);
        return message.reply(`❏ *Cooldown:* Debes esperar ${restante} minutos para buscar más mobs.`);
    }

    // Seleccionamos un tipo de mob al azar de tu lista mobsData
    const mobTemplate = mobsData[Math.floor(Math.random() * mobsData.length)];
    
    // Generamos los 3 niveles
    const enemigos = [];
    let poderTotal = 0;
    for(let i = 0; i < 3; i++) {
        const lvl = Math.floor(Math.random() * (mobTemplate.lvls[1] - mobTemplate.lvls[0] + 1)) + mobTemplate.lvls[0];
        enemigos.push(lvl);
        poderTotal += lvl;
    }

    // Guardamos el mob específico para este chat
    mobActual[message.from] = {
        nombre: mobTemplate.nombre,
        poderTotal: poderTotal,
        recompensa: Math.floor(poderTotal / 2),
        vencido: false
    };

    // Actualizar el cooldown en memoria
    cooldownsBuscarmob[userId] = ahora;

    return message.reply(`
『  *MOBS DETECTADOS* 』

↳ Tipo: [ ${mobTemplate.nombre} ]
↳ Cantidad: [ 3 ]
↳ Poder Total: [ ${poderTotal.toLocaleString()} ]

> ${mobTemplate.desc}
> Usa *${prefix}fight* personaje1, personaje2, personaje3 para intentar derrotarlos.
`);
}

// --------- COMANDO ?fight (TODO EN UNO) ---------
if (comando.startsWith('fight')) {
    const mob = mobActual[message.from];
    if (!mob || mob.vencido) {
        return message.reply("❏ *Error:* No hay mobs activos. Usa ?buscarmob primero.");
    }

    const argsF = message.body.slice(prefix.length + 5).trim();
    const nombres = argsF.split(",").map(n => n.trim().toLowerCase());

    if (!argsF || nombres.length < 1 || nombres.length > 3) {
        return message.reply(`❏ *Uso:* ${prefix}fight Personaje1, Personaje2\n> Máximo 3 personajes separados por coma.`);
    }

    // CARGA CORRECTA: Usamos tu lógica de harem por grupo
    const haremData = cargarHarem(); // Esto lee haremPorGrupo.json
    const misPersonajes = haremData[message.from]?.[userId] || [];

    if (misPersonajes.length === 0) {
        return message.reply("❏ *Error:* No tienes personajes en este grupo.");
    }

    let equipoTemp = [];
    let poderTotalEquipo = 0;

    // Buscar a los personajes
    for (let nombreBusqueda of nombres) {
        // Buscamos coincidencia exacta o parcial en tu lista de personajes del grupo
        const pj = misPersonajes.find(p => p.nombre.toLowerCase().includes(nombreBusqueda));
        
        if (pj) {
            // Calculamos el poder usando tu fórmula de nivel actual: Valor * 1.20^(nivel-1)
            let lvl = pj.level || 1;
            let valorBase = Number(pj.valor) || 0;
            let valorReal = valorBase * Math.pow(1.20, (lvl - 1));
            
            equipoTemp.push(pj);
            poderTotalEquipo += valorReal;
        } else {
            return message.reply(`❏ *Error:* No tienes a [ ${nombreBusqueda} ] en tu harem de este grupo.`);
        }
    }

    const poderFinalUser = Math.floor(poderTotalEquipo);

    if (poderFinalUser > mob.poderTotal) {
        const economia = cargarEconomia();
        asegurarUsuario(economia, userId);
        
        const premio = mob.recompensa;
        economia[userId].dinero += premio;
        
        // DAR EXPERIENCIA: Usamos tu sistema de level y exp
        equipoTemp.forEach(pjPeleador => {
            const idx = haremData[message.from][userId].findIndex(p => p.nombre === pjPeleador.nombre);
            if (idx !== -1) {
                let personaje = haremData[message.from][userId][idx];
                personaje.exp = (personaje.exp || 0) + 50; // Damos 50 de EXP por ganar
                
                // Lógica de subir nivel que ya usas en duelos
                let xpReq = Math.floor(100 * Math.pow(1.1, (personaje.level || 1) - 1));
                if (personaje.exp >= xpReq) {
                    personaje.level = (personaje.level || 1) + 1;
                    personaje.exp = 0;
                }
            }
        });

        mobActual[message.from].vencido = true;
        guardarEconomia(economia);
        guardarHarem(haremData); // Guarda en haremPorGrupo.json

        return message.reply(`
『  *VICTORIA* 』

↳ Equipo: [ ${equipoTemp.map(p => p.nombre).join(", ")} ]
↳ Tu Poder: [ ${poderFinalUser.toLocaleString()} ]
↳ Poder Mob: [ ${mob.poderTotal.toLocaleString()} ]

> ¡Has derrotado a los ${mob.nombre}!
> Ganaste: $${premio.toLocaleString()}
> Tus personajes ganaron EXP y están más cerca del siguiente nivel.
`);
    } else {
        return message.reply(`
『  *DERROTA* 』

↳ Tu Poder: [ ${poderFinalUser.toLocaleString()} ]
↳ Poder Mob: [ ${mob.poderTotal.toLocaleString()} ]

> No fue suficiente. Te faltó [ ${(mob.poderTotal - poderFinalUser).toLocaleString()} ] de poder.
`);
    }
}



// --- COMANDO PARA DAR DINERO (SOLO ADMIN) ---
if (message.body.startsWith(prefix + 'addmoney')) {
    const adminID = '232246195839008@lid'; 
    if (userId !== adminID) return message.reply("⚠️ No tienes permiso para usar la impresora de billetes.");

    // Extraer la cantidad del mensaje
    const parts = message.body.split(/\s+/); // Divide por espacios
    let cantidad = parseInt(parts[1]); // El primer argumento después del comando

    if (isNaN(cantidad)) {
        return message.reply("❌ Uso: `?addmoney [cantidad]`\nEjemplo: `?addmoney 1000000` ");
    }

    try {
        const economia = cargarEconomia();
        let targetId = userId;

        // Si mencionas a alguien, el dinero es para él
        if (message.mentionedIds && message.mentionedIds.length > 0) {
            targetId = message.mentionedIds[0];
        }

        // Asegurar que el usuario existe en el JSON
        if (!economia[targetId]) {
            economia[targetId] = { dinero: 0, lastDaily: "", lastWork: 0, lastCrime: 0 };
        }

        // SUMAR DINERO
        economia[targetId].dinero += cantidad;

        // GUARDAR CAMBIOS
        guardarEconomia(economia);

        console.log(`[ADMIN] Se añadieron ${cantidad} a ${targetId}`);

        const nombreExito = targetId === userId ? "tu cuenta" : "la cuenta del usuario";
        return message.reply(`✅ *¡TRANSACCIÓN EXITOSA!*\n\n💵 Se han sumado: *$${cantidad.toLocaleString()}*\n👤 Destino: ${nombreExito}\n🏦 Saldo actual: *$${economia[targetId].dinero.toLocaleString()}*`);

    } catch (e) {
        console.log("Error en addmoney:", e);
        return message.reply("⚠ Hubo un problema al acceder al archivo de economía.");
    }
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
        valor: 999999999,
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
    const listaReacciones = ['cry', 'sad', 'happy', 'angry', 'laugh', 'dance', 'scared', 'eat', 'sleep', 'cafe', 'hug', 'kiss'];
    const comandoLimpio = comando.split(/\s+/)[0];

    if (listaReacciones.includes(comandoLimpio)) {
        const gifPath = animeGifs[comandoLimpio][Math.floor(Math.random() * animeGifs[comandoLimpio].length)];
        const outputPath = `./temp_${Date.now()}.mp4`; // Archivo temporal
        
        const authorContact = await message.getContact();
        const authorName = authorContact.pushname || 'Usuario';
        const mencionadoId = message.mentionedIds[0];
        
        let nombreMencionado = "";
        if (mencionadoId) {
            const contactMencionado = await client.getContactById(mencionadoId);
            nombreMencionado = `@${contactMencionado.pushname || contactMencionado.number.split('@')[0]}`;
        }

        let textoFinal = mencionadoId 
            ? `*${authorName}* hizo un ${comandoLimpio} con ${nombreMencionado}` 
            : `*${authorName}* hizo un ${comandoLimpio}`;

        // Personalización rápida de frases
        if (comandoLimpio === 'kiss') textoFinal = mencionadoId ? `*${authorName}* le dio un beso a ${nombreMencionado} 💋` : `*${authorName}* lanzó un beso al aire... 💋`;
        if (comandoLimpio === 'hug') textoFinal = mencionadoId ? `*${authorName}* le dio un abrazo a ${nombreMencionado} 🤗` : `*${authorName}* dio un abrazo al aire... 🤗`;

        // USAMOS FFMPEG DE FORMA SEGURA
        ffmpeg(gifPath)
            .outputOptions([
                '-pix_fmt yuv420p', // Formato compatible con todos los celulares
                '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2' // Asegura dimensiones pares para MP4
            ])
            .toFormat('mp4')
            .on('end', async () => {
                try {
                    const media = MessageMedia.fromFilePath(outputPath);
                    await client.sendMessage(message.from, media, {
                        caption: textoFinal,
                        sendVideoAsGif: true,
                        mentions: mencionadoId ? [mencionadoId] : []
                    });
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); // Borra el temporal
                } catch (e) { console.log("Error enviando:", e); }
            })
            .on('error', (err) => {
                console.log("Error FFMPEG:", err);
                message.reply("❌ Error estético: No pude procesar el movimiento.");
            })
            .save(outputPath);

        return;
    }

    // --- DETECTOR DE COMANDO INEXISTENTE ---
    // Si llegamos aquí y el mensaje empieza con el prefijo, es que no reconoció ningún comando de arriba
    if (message.body.startsWith(prefix)) {
        const comandoBase = comando.split(/\s+/)[0];
        // Lista de comandos que SÍ existen para que no se confunda
        const misComandos = ['duel', 'rw', 'harem', 'wimage', 'shop', 'bal', 'buy', 'crime', 'daily', 'c', 'help', 'menu', 'ping', 'charinfo', 'charlist', 'pay', 'cooldowns', 'w', 'pokevo', 'accept', 'pick', 'yt', 's', 'say', 'tr', 'dice', 'smob', 'fight', 'reload', 'addmoney', 'charshop', 'bchar'];
        
        if (!misComandos.includes(comandoBase) && !listaReacciones.includes(comandoBase)) {
            return message.reply(`⌦ El comando *${prefix}${comandoBase}* no existe.\n Usa *${prefix}help* para ver la lista de comandos`);
        }
    }

}); // CIERRE FINAL DE message_create

// --------- INICIALIZAR ---------
client.initialize();

// ---------------- ANTI-CRASH GLOBAL ----------------
process.on('uncaughtException', (err) => {
    console.log('🚨 YakBot casi se crashea! (uncaughtException)');
    console.log(err);

});















