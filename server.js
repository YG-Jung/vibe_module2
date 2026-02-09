// Linux Kernel 6.12 로그 조회 백엔드 서버
const http = require('http');
const https = require('https');
const url = require('url');
const zlib = require('zlib');

const PORT = 3000;
const KERNEL_LOG_URL = 'https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/log/?h=linux-6.12.y';
const KERNEL_ATOM_URL = 'https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/atom/?h=linux-6.12.y';

// CORS 헤더 설정
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// 커널 로그 가져오기 (압축 처리 및 브라우저 완전 모방)
function fetchKernelLogs() {
    return new Promise((resolve, reject) => {
        console.log('📡 Fetching kernel logs from:', KERNEL_LOG_URL);

        const parsedUrl = new URL(KERNEL_LOG_URL);

        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                // 최신 Chrome 브라우저 User-Agent
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

                // Accept 헤더 - HTML 우선
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',

                // 언어 설정
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',

                // 압축 형식 지원
                'Accept-Encoding': 'gzip, deflate, br',

                // 캐시 제어
                'Cache-Control': 'max-age=0',

                // 연결 유지
                'Connection': 'keep-alive',

                // DNT (Do Not Track)
                'DNT': '1',

                // 보안 관련 헤더
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',

                // HTTPS 업그레이드 요청
                'Upgrade-Insecure-Requests': '1',

                // Chrome 버전 정보
                'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            }
        };

        console.log('📤 요청 헤더:', options.headers);

        https.get(options, (response) => {
            console.log('✅ 응답 상태:', response.statusCode, response.statusMessage);
            console.log('📋 응답 헤더:', response.headers);
            console.log('📦 Content-Encoding:', response.headers['content-encoding']);

            // 리다이렉트 처리 (301, 302, 307, 308)
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                console.log('↪️ 리다이렉트:', response.headers.location);

                // 상대 경로를 절대 경로로 변환
                const redirectUrl = new URL(response.headers.location, KERNEL_LOG_URL);
                console.log('↪️ 리다이렉트 URL:', redirectUrl.href);

                // 재귀 호출로 리다이렉트 따라가기
                https.get(redirectUrl.href, options, (redirectResponse) => {
                    handleResponse(redirectResponse, resolve, reject);
                }).on('error', reject);

                return;
            }

            // 200 OK가 아니면 에러
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }

            handleResponse(response, resolve, reject);
        }).on('error', (error) => {
            console.error('❌ 요청 실패:', error.message);
            reject(error);
        });
    });
}

// 응답 처리 (압축 해제 포함)
function handleResponse(response, resolve, reject) {
    let stream = response;
    const encoding = response.headers['content-encoding'];

    // 압축 해제 스트림 설정
    if (encoding === 'gzip') {
        console.log('🗜️ gzip 압축 해제 중...');
        stream = response.pipe(zlib.createGunzip());
    } else if (encoding === 'deflate') {
        console.log('🗜️ deflate 압축 해제 중...');
        stream = response.pipe(zlib.createInflate());
    } else if (encoding === 'br') {
        console.log('🗜️ brotli 압축 해제 중...');
        stream = response.pipe(zlib.createBrotliDecompress());
    } else {
        console.log('📄 압축 없음');
    }

    let data = '';

    // UTF-8로 디코딩
    stream.setEncoding('utf8');

    stream.on('data', (chunk) => {
        data += chunk;
    });

    stream.on('end', () => {
        console.log('✅ 데이터 수신 완료. 크기:', data.length, 'bytes');
        console.log('📝 HTML 시작 부분:', data.substring(0, 200));
        resolve(data);
    });

    stream.on('error', (error) => {
        console.error('❌ 스트림 에러:', error.message);
        reject(error);
    });
}

// Atom 피드 가져오기 (단일 페이지)
function fetchSingleAtomPage(offset = 0) {
    return new Promise((resolve, reject) => {
        const urlWithOffset = `${KERNEL_ATOM_URL}&ofs=${offset}`;
        console.log('📡 Fetching Atom feed from:', urlWithOffset);

        const parsedUrl = new URL(urlWithOffset);

        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/atom+xml,application/xml,text/xml,*/*',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
            }
        };

        console.log('📤 요청 헤더:', options.headers);

        https.get(options, (response) => {
            console.log('✅ 응답 상태:', response.statusCode, response.statusMessage);
            console.log('📋 응답 헤더:', response.headers);

            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }

            handleResponse(response, resolve, reject);
        }).on('error', (error) => {
            console.error('❌ 요청 실패:', error.message);
            reject(error);
        });
    });
}

// 여러 페이지의 Atom 피드 가져오기 (30개)
async function fetchAtomFeed(startOffset = 0, count = 30) {
    console.log(`📡 Fetching ${count} commits starting from offset ${startOffset}`);

    const pages = Math.ceil(count / 10); // 10개씩 가져오므로
    const promises = [];

    for (let i = 0; i < pages; i++) {
        const offset = startOffset + (i * 10);
        promises.push(fetchSingleAtomPage(offset));
    }

    try {
        const xmlPages = await Promise.all(promises);
        console.log(`✅ ${xmlPages.length}개 페이지 가져오기 완료`);

        // XML 파싱하여 entry들을 추출하고 합치기
        const combinedEntries = [];

        xmlPages.forEach((xml, idx) => {
            // entry 태그들을 추출
            const entryMatches = xml.match(/<entry>[\s\S]*?<\/entry>/g);
            if (entryMatches) {
                combinedEntries.push(...entryMatches);
                console.log(`  페이지 ${idx + 1}: ${entryMatches.length}개 entry`);
            }
        });

        console.log(`📦 총 ${combinedEntries.length}개 entry 추출`);

        // 첫 번째 페이지의 XML 구조를 사용하여 합친 XML 생성
        const firstXml = xmlPages[0];

        // feed 태그의 시작과 끝 찾기
        const feedStartIndex = firstXml.indexOf('<feed');
        const feedEndTagIndex = firstXml.indexOf('</feed>');

        if (feedStartIndex === -1 || feedEndTagIndex === -1) {
            console.error('❌ XML 구조 오류:');
            console.error('  feedStartIndex:', feedStartIndex);
            console.error('  feedEndTagIndex:', feedEndTagIndex);
            console.error('  XML 미리보기:', firstXml.substring(0, 500));
            throw new Error('XML 구조를 파싱할 수 없습니다');
        }

        // feed 태그의 시작 부분 (속성 포함)
        const feedOpenTagEnd = firstXml.indexOf('>', feedStartIndex);
        const xmlHeader = firstXml.substring(0, feedOpenTagEnd + 1);

        // 합친 XML 생성
        const combinedXml = xmlHeader + '\n' +
                           combinedEntries.join('\n') + '\n' +
                           '</feed>';

        console.log('✅ 합친 XML 생성 완료. 크기:', combinedXml.length);

        return combinedXml;
    } catch (error) {
        console.error('❌ 여러 페이지 가져오기 실패:', error.message);
        throw error;
    }
}

// HTTP 서버 생성
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    console.log(`\n🔔 요청: ${req.method} ${pathname}`);

    // CORS preflight 처리
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        res.writeHead(204);
        res.end();
        return;
    }

    // 커널 로그 API (HTML)
    if (pathname === '/api/kernel-logs' && req.method === 'GET') {
        setCorsHeaders(res);

        try {
            const html = await fetchKernelLogs();

            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Length': Buffer.byteLength(html)
            });
            res.end(html);

            console.log('✅ 응답 전송 완료');
        } catch (error) {
            console.error('❌ 에러:', error.message);

            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
            }));
        }
        return;
    }

    // Atom 피드 API
    if (pathname === '/api/atom-feed' && req.method === 'GET') {
        setCorsHeaders(res);

        try {
            // offset 파라미터 추출
            const offset = parseInt(parsedUrl.query.offset) || 0;
            console.log('📥 요청된 offset:', offset);

            const xml = await fetchAtomFeed(offset);

            res.writeHead(200, {
                'Content-Type': 'application/atom+xml; charset=utf-8',
                'Content-Length': Buffer.byteLength(xml)
            });
            res.end(xml);

            console.log('✅ Atom 피드 전송 완료 (offset:', offset, ')');
        } catch (error) {
            console.error('❌ 에러:', error.message);

            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
            }));
        }
        return;
    }

    // 헬스 체크
    if (pathname === '/health' && req.method === 'GET') {
        setCorsHeaders(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        }));
        return;
    }

    // HTML 미리보기 (디버그용)
    if (pathname === '/api/preview' && req.method === 'GET') {
        setCorsHeaders(res);

        try {
            const html = await fetchKernelLogs();

            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8'
            });
            res.end(html);

            console.log('✅ HTML 미리보기 전송 완료');
        } catch (error) {
            console.error('❌ 에러:', error.message);

            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
            }));
        }
        return;
    }

    // 404
    setCorsHeaders(res);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        error: 'Not Found',
        path: pathname
    }));
});

// 서버 시작
server.listen(PORT, () => {
    console.log('========================================');
    console.log('🐧 Linux Kernel Log Server');
    console.log('========================================');
    console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
    console.log(`📡 API 엔드포인트: http://localhost:${PORT}/api/kernel-logs`);
    console.log(`💚 헬스 체크: http://localhost:${PORT}/health`);
    console.log('========================================\n');
});

// 종료 처리
process.on('SIGINT', () => {
    console.log('\n\n👋 서버 종료 중...');
    server.close(() => {
        console.log('✅ 서버가 정상적으로 종료되었습니다.');
        process.exit(0);
    });
});
