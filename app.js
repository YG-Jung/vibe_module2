// Linux Kernel 6.12 Git 로그 조회 애플리케이션

const KERNEL_LOG_URL = 'https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/log/?h=linux-6.12.y';
const BACKEND_API_URL = 'http://localhost:3000/api/kernel-logs';

// 직접 접근 vs 백엔드 사용 선택
const USE_DIRECT_ACCESS = true; // true: 직접 접근, false: 백엔드 사용

// DOM 요소
const loadBtn = document.getElementById('loadBtn');
const statusEl = document.getElementById('status');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const logContainer = document.getElementById('logContainer');

// 페이지 로드 시 디버그 정보 출력
console.log('========================================');
console.log('🐧 Linux Kernel 6.12 Git 로그 조회 앱');
console.log('========================================');
console.log('원본 URL:', KERNEL_LOG_URL);
console.log('백엔드 API:', BACKEND_API_URL);
console.log('DOM 요소 체크:');
console.log('  - loadBtn:', loadBtn ? '✓' : '✗');
console.log('  - statusEl:', statusEl ? '✓' : '✗');
console.log('  - loadingEl:', loadingEl ? '✓' : '✗');
console.log('  - errorEl:', errorEl ? '✓' : '✗');
console.log('  - logContainer:', logContainer ? '✓' : '✗');
console.log('========================================\n');

// 이벤트 리스너
loadBtn.addEventListener('click', loadKernelLogs);

// 메인 함수: 커널 로그 불러오기
async function loadKernelLogs() {
    console.log('========================================');
    console.log('🚀 로그 불러오기 시작');
    console.log('========================================');

    try {
        showLoading();
        hideError();
        loadBtn.disabled = true;
        statusEl.textContent = '로그를 가져오는 중...';

        console.log('📡 Fetching logs from backend API:', BACKEND_API_URL);
        const html = await fetchKernelLogs();
        console.log('✅ HTML 가져오기 완료. 길이:', html.length, 'bytes');
        console.log('HTML 미리보기 (처음 500자):', html.substring(0, 500));

        console.log('\n📝 커밋 파싱 시작...');
        const commits = parseCommits(html);
        console.log('✅ 파싱 완료. 총 커밋 수:', commits.length);

        if (commits.length > 0) {
            console.log('\n샘플 커밋 (첫 3개):');
            commits.slice(0, 3).forEach((commit, idx) => {
                console.log(`\n  커밋 #${idx + 1}:`, {
                    hash: commit.hash,
                    date: commit.date,
                    author: commit.author,
                    message: commit.message.substring(0, 100) + '...',
                    version: commit.version,
                    summary: commit.summary
                });
            });
        } else {
            console.warn('⚠️ 파싱된 커밋이 없습니다!');
        }

        console.log('\n📦 버전별 그룹화 시작...');
        const groupedCommits = groupByVersion(commits);
        console.log('✅ 그룹화 완료. 버전 그룹 수:', groupedCommits.size);
        groupedCommits.forEach((commits, version) => {
            console.log(`  - ${version}: ${commits.length}개 커밋`);
        });

        console.log('\n🎨 UI 렌더링 시작...');
        displayLogs(groupedCommits);
        console.log('✅ 렌더링 완료');

        statusEl.textContent = `총 ${commits.length}개의 커밋을 불러왔습니다.`;
        hideLoading();

        console.log('\n========================================');
        console.log('✅ 모든 작업 완료!');
        console.log('========================================');
    } catch (error) {
        console.error('\n❌ 에러 발생!');
        console.error('에러 타입:', error.name);
        console.error('에러 메시지:', error.message);
        console.error('스택 트레이스:', error.stack);
        showError('로그를 불러오는 중 오류가 발생했습니다: ' + error.message);
        hideLoading();
        statusEl.textContent = '';
    } finally {
        loadBtn.disabled = false;
    }
}

// 커널 로그 HTML 가져오기
async function fetchKernelLogs() {
    if (USE_DIRECT_ACCESS) {
        console.log('  → 🎯 직접 접근 모드');
        console.log('  → 대상 URL:', KERNEL_LOG_URL);
        return await fetchDirectly();
    } else {
        console.log('  → 🔄 백엔드 API 모드');
        console.log('  → 백엔드 API URL:', BACKEND_API_URL);
        return await fetchViaBackend();
    }
}

// 직접 접근 (CORS 테스트)
async function fetchDirectly() {
    console.log('  → Fetch 요청 시작 (직접 접근)...');

    try {
        const response = await fetch(KERNEL_LOG_URL, {
            method: 'GET',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            mode: 'cors', // CORS 요청
            credentials: 'omit' // 쿠키 제외
        });

        console.log('  → 응답 상태:', response.status, response.statusText);
        console.log('  → 응답 헤더:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('  → 에러 응답:', errorText.substring(0, 500));
            throw new Error(`HTTP 오류! 상태: ${response.status}`);
        }

        console.log('  → 응답 본문 읽는 중...');
        const text = await response.text();
        console.log('  → 응답 본문 길이:', text.length);

        return text;
    } catch (error) {
        console.error('  ❌ 직접 접근 실패:', error.message);

        if (error.message.includes('CORS') || error.name === 'TypeError') {
            console.error('  💡 CORS 정책으로 인해 직접 접근이 차단되었습니다.');
            console.error('  💡 USE_DIRECT_ACCESS를 false로 설정하고 백엔드 서버를 사용하세요.');
        }

        throw error;
    }
}

// 백엔드를 통한 접근
async function fetchViaBackend() {
    console.log('  → Fetch 요청 시작 (백엔드 경유)...');

    try {
        const response = await fetch(BACKEND_API_URL, {
            method: 'GET',
            headers: {
                'Accept': 'text/html',
            }
        });

        console.log('  → 응답 상태:', response.status, response.statusText);
        console.log('  → 응답 헤더:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('  → 에러 응답:', errorText);
            throw new Error(`HTTP 오류! 상태: ${response.status} - ${errorText}`);
        }

        console.log('  → 응답 본문 읽는 중...');
        const text = await response.text();
        console.log('  → 응답 본문 길이:', text.length);

        return text;
    } catch (error) {
        if (error.message.includes('Failed to fetch')) {
            console.error('  ❌ 백엔드 서버에 연결할 수 없습니다!');
            console.error('  💡 server.js를 실행했는지 확인하세요: node server.js');
            throw new Error('백엔드 서버에 연결할 수 없습니다. server.js를 실행했는지 확인하세요.');
        }
        throw error;
    }
}

// HTML 파싱하여 커밋 정보 추출
function parseCommits(html) {
    console.log('  → DOMParser로 HTML 파싱 중...');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const commits = [];

    // cgit의 log 테이블에서 커밋 정보 추출
    console.log('  → 테이블 검색: "table.list tr"');
    const rows = doc.querySelectorAll('table.list tr');
    console.log(`  → 찾은 행 수: ${rows.length}`);

    // 다양한 선택자로 테이블 찾기 시도
    if (rows.length === 0) {
        console.warn('  ⚠️ table.list가 없습니다. 다른 선택자 시도...');
        const allTables = doc.querySelectorAll('table');
        console.log(`  → 전체 테이블 수: ${allTables.length}`);
        allTables.forEach((table, idx) => {
            console.log(`    테이블 #${idx + 1}:`, {
                class: table.className,
                id: table.id,
                rows: table.querySelectorAll('tr').length
            });
        });

        const allRows = doc.querySelectorAll('tr');
        console.log(`  → 전체 행 수: ${allRows.length}`);
    }

    let parsedCount = 0;
    let skippedCount = 0;

    rows.forEach((row, idx) => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) {
            skippedCount++;
            return;
        }

        if (idx < 3) {
            console.log(`  → 행 #${idx + 1} 파싱 시도 (셀 수: ${cells.length})`);
        }

        const commit = parseCommitRow(row);
        if (commit) {
            commits.push(commit);
            parsedCount++;
            if (parsedCount <= 3) {
                console.log(`    ✓ 커밋 파싱 성공:`, commit.message.substring(0, 60));
            }
        } else {
            if (idx < 3) {
                console.log(`    ✗ 커밋 파싱 실패`);
            }
        }
    });

    console.log(`  → 파싱 결과: 성공 ${parsedCount}개, 스킵 ${skippedCount}개`);

    return commits;
}

// 개별 커밋 행 파싱
function parseCommitRow(row) {
    try {
        const cells = row.querySelectorAll('td');

        // 테이블 헤더 행이거나 셀이 부족하면 스킵
        if (cells.length < 3) {
            return null;
        }

        // cgit 테이블 구조: [Age, Commit message, Author, Files, Lines]

        // 1. Age (날짜)
        const ageCell = cells[0];
        const ageSpan = ageCell.querySelector('span.age-days, span');
        const date = ageSpan ? ageSpan.textContent.trim() : ageCell.textContent.trim();

        // 2. Commit message (메시지와 커밋 해시)
        const messageCell = cells[1];
        const messageLink = messageCell.querySelector('a');

        if (!messageLink) {
            return null; // 링크가 없으면 유효한 커밋 행이 아님
        }

        const message = messageLink.textContent.trim();

        // 커밋 해시 추출 (링크의 href에서)
        // 예: /pub/scm/.../commit/?h=linux-6.12.y&id=ff2177382799753070b71747f646963147eabc7c
        const href = messageLink.getAttribute('href');
        let hash = '';

        if (href) {
            const idMatch = href.match(/[?&]id=([a-f0-9]+)/);
            if (idMatch) {
                hash = idMatch[1];
            }
        }

        // 3. Author
        const authorCell = cells[2];
        const author = authorCell.textContent.trim();

        // 메시지나 해시가 비어있으면 유효하지 않은 행
        if (!message || !hash) {
            return null;
        }

        // 버전 태그 추출 (메시지에서)
        // "Linux 6.12.69" 또는 "v6.12.69" 형식
        const versionMatch = message.match(/Linux (6\.12\.\d+)/i) ||
                           message.match(/v(6\.12\.\d+)/i) ||
                           message.match(/(6\.12\.\d+)/);
        const version = versionMatch ? versionMatch[1] : null;

        return {
            date,
            message,
            author,
            hash,
            version,
            summary: generateSummary(message)
        };
    } catch (error) {
        console.error('❌ parseCommitRow 에러:', error);
        console.error('  → 문제가 된 행:', row.innerHTML.substring(0, 200));
        return null;
    }
}

// 커밋 메시지를 한글로 요약
function generateSummary(message) {
    const lowerMessage = message.toLowerCase();

    // 버전 릴리스
    if (message.match(/Linux 6\.12\.\d+/i)) {
        return '📦 새로운 버전 릴리스';
    }

    // 주요 키워드 기반 분류
    if (lowerMessage.includes('fix') || lowerMessage.includes('bug')) {
        return '🔧 버그 수정';
    }
    if (lowerMessage.includes('revert')) {
        return '↩️ 이전 커밋 되돌림';
    }
    if (lowerMessage.includes('add') || lowerMessage.includes('new')) {
        return '✨ 새로운 기능 추가';
    }
    if (lowerMessage.includes('update') || lowerMessage.includes('improve')) {
        return '⬆️ 기능 개선 및 업데이트';
    }
    if (lowerMessage.includes('remove') || lowerMessage.includes('delete')) {
        return '🗑️ 코드 제거';
    }
    if (lowerMessage.includes('security') || lowerMessage.includes('cve')) {
        return '🔒 보안 패치';
    }
    if (lowerMessage.includes('performance') || lowerMessage.includes('optimize')) {
        return '⚡ 성능 최적화';
    }
    if (lowerMessage.includes('driver')) {
        return '🔌 드라이버 관련 변경';
    }
    if (lowerMessage.includes('doc') || lowerMessage.includes('documentation')) {
        return '📝 문서 업데이트';
    }
    if (lowerMessage.includes('refactor') || lowerMessage.includes('cleanup')) {
        return '♻️ 코드 리팩토링';
    }
    if (lowerMessage.includes('merge')) {
        return '🔀 브랜치 병합';
    }

    // 서브시스템별 분류
    if (lowerMessage.includes('net:') || lowerMessage.includes('network')) {
        return '🌐 네트워크 서브시스템 변경';
    }
    if (lowerMessage.includes('fs:') || lowerMessage.includes('filesystem')) {
        return '💾 파일시스템 변경';
    }
    if (lowerMessage.includes('mm:') || lowerMessage.includes('memory')) {
        return '🧠 메모리 관리 변경';
    }
    if (lowerMessage.includes('usb:')) {
        return '🔌 USB 서브시스템 변경';
    }
    if (lowerMessage.includes('arm') || lowerMessage.includes('x86')) {
        return '🏗️ 아키텍처 관련 변경';
    }

    return '📋 일반 커밋';
}

// 버전별로 커밋 그룹화
function groupByVersion(commits) {
    const grouped = new Map();

    commits.forEach(commit => {
        const key = commit.version || 'Other';
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key).push(commit);
    });

    // 버전 순으로 정렬
    const sortedGroups = new Map([...grouped.entries()].sort((a, b) => {
        if (a[0] === 'Other') return 1;
        if (b[0] === 'Other') return -1;
        return b[0].localeCompare(a[0], undefined, { numeric: true });
    }));

    return sortedGroups;
}

// 로그 표시
function displayLogs(groupedCommits) {
    console.log('  → 로그 컨테이너 초기화');
    logContainer.innerHTML = '';

    if (groupedCommits.size === 0) {
        console.warn('  ⚠️ 표시할 커밋이 없습니다!');
        logContainer.innerHTML = `
            <div class="no-data">
                <p>로그 데이터가 없습니다.</p>
                <small>다시 시도해주세요.</small>
            </div>
        `;
        return;
    }

    console.log(`  → ${groupedCommits.size}개의 버전 그룹 렌더링 시작`);
    let totalRendered = 0;

    groupedCommits.forEach((commits, version) => {
        console.log(`    → 버전 "${version}" 렌더링 중... (${commits.length}개 커밋)`);
        const versionGroup = createVersionGroup(version, commits);
        logContainer.appendChild(versionGroup);
        totalRendered += commits.length;
    });

    console.log(`  ✅ 총 ${totalRendered}개 커밋 렌더링 완료`);
}

// 버전 그룹 생성
function createVersionGroup(version, commits) {
    const group = document.createElement('div');
    group.className = 'version-group';

    const header = document.createElement('div');
    header.className = 'version-header';
    header.innerHTML = `
        <h2>${version === 'Other' ? '기타 커밋' : 'v' + version}</h2>
        <span class="count">${commits.length}개 커밋</span>
    `;

    const content = document.createElement('div');
    content.className = 'version-content';

    commits.forEach(commit => {
        const commitEl = createCommitElement(commit);
        content.appendChild(commitEl);
    });

    // 토글 기능
    header.addEventListener('click', () => {
        content.classList.toggle('collapsed');
    });

    group.appendChild(header);
    group.appendChild(content);

    return group;
}

// 개별 커밋 요소 생성
function createCommitElement(commit) {
    const commitEl = document.createElement('div');
    commitEl.className = 'commit';

    commitEl.innerHTML = `
        <div class="commit-header">
            <span class="commit-hash">${commit.hash.substring(0, 12)}</span>
            <span class="commit-date">${commit.date}</span>
        </div>
        <div class="commit-author">작성자: ${commit.author}</div>
        <div class="commit-message">${escapeHtml(commit.message)}</div>
        <div class="commit-summary">${commit.summary}</div>
    `;

    return commitEl;
}

// HTML 이스케이프
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// UI 헬퍼 함수
function showLoading() {
    loadingEl.classList.remove('hidden');
    logContainer.innerHTML = '';
}

function hideLoading() {
    loadingEl.classList.add('hidden');
}

function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

function hideError() {
    errorEl.classList.add('hidden');
}
