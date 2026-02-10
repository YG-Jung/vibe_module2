// Linux Kernel 6.12 Git 로그 조회 애플리케이션

const KERNEL_LOG_URL = 'https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/log/?h=linux-6.12.y';
const BACKEND_API_URL = 'http://localhost:3000/api/kernel-logs';
const ATOM_FEED_API_URL = 'http://localhost:3000/api/atom-feed';

// 데이터 소스 선택: 'direct', 'backend', 'atom'
const DATA_SOURCE = 'atom'; // atom: Atom 피드 (권장)

// DOM 요소
const loadBtn = document.getElementById('loadBtn');
const statusEl = document.getElementById('status');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const logContainer = document.getElementById('logContainer');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');

// 페이지네이션 상태
const COMMITS_PER_PAGE = 30; // 페이지당 커밋 수
let currentOffset = 0;
let totalCommitsLoaded = 0;
let allCommits = []; // 모든 로드된 커밋 저장

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
loadBtn.addEventListener('click', () => loadKernelLogs(true)); // true = 초기 로드
loadMoreBtn.addEventListener('click', () => loadKernelLogs(false)); // false = 추가 로드

// 메인 함수: 커널 로그 불러오기
async function loadKernelLogs(isInitial = true) {
    console.log('========================================');
    console.log(isInitial ? '🚀 로그 불러오기 시작' : '📥 추가 로그 불러오기');
    console.log('========================================');

    try {
        showLoading();
        hideError();
        loadBtn.disabled = true;
        loadMoreBtn.disabled = true;

        if (isInitial) {
            // 초기 로드: 상태 초기화
            currentOffset = 0;
            totalCommitsLoaded = 0;
            allCommits = [];
            logContainer.innerHTML = '';
            statusEl.textContent = '로그를 가져오는 중...';
        } else {
            // 추가 로드
            currentOffset += COMMITS_PER_PAGE; // 다음 페이지
            statusEl.textContent = `추가 로그를 가져오는 중... (${currentOffset}번째부터)`;
        }

        console.log('📡 Fetching logs... (offset:', currentOffset, ')');
        const data = await fetchKernelLogs(currentOffset);
        console.log('✅ 데이터 가져오기 완료. 길이:', data.length, 'bytes');

        console.log('\n📝 커밋 파싱 시작...');
        let commits;
        if (DATA_SOURCE === 'atom') {
            commits = parseCommitsFromAtom(data);
        } else {
            commits = parseCommits(data);
        }
        console.log('✅ 파싱 완료. 이번 페이지 커밋 수:', commits.length);

        if (commits.length === 0) {
            console.warn('⚠️ 더 이상 로드할 커밋이 없습니다!');
            hideLoadMoreBtn();
            statusEl.textContent = `총 ${totalCommitsLoaded}개의 커밋을 불러왔습니다. (모두 로드됨)`;
            hideLoading();
            return;
        }

        // 새 커밋을 전체 목록에 추가
        allCommits = allCommits.concat(commits);
        totalCommitsLoaded = allCommits.length;

        console.log('\n📦 버전별 그룹화 시작...');
        const groupedCommits = groupByVersion(allCommits);
        console.log('✅ 그룹화 완료. 버전 그룹 수:', groupedCommits.size);

        console.log('\n🎨 UI 렌더링 시작...');
        displayLogs(groupedCommits);
        console.log('✅ 렌더링 완료');

        statusEl.textContent = `총 ${totalCommitsLoaded}개의 커밋을 불러왔습니다.`;

        // "더 보기" 버튼 표시
        showLoadMoreBtn();

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
        loadMoreBtn.disabled = false;
    }
}

// 커널 로그 HTML 가져오기
async function fetchKernelLogs(offset = 0) {
    if (DATA_SOURCE === 'direct') {
        console.log('  → 🎯 직접 접근 모드');
        console.log('  → 대상 URL:', KERNEL_LOG_URL);
        return await fetchDirectly();
    } else if (DATA_SOURCE === 'atom') {
        console.log('  → 📡 Atom 피드 모드 (권장)');
        console.log('  → Atom 피드 API URL:', ATOM_FEED_API_URL);
        return await fetchAtomFeed(offset);
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

// Atom 피드 가져오기
async function fetchAtomFeed(offset = 0) {
    console.log('  → Fetch 요청 시작 (Atom 피드, offset:', offset, ')...');

    try {
        const url = `${ATOM_FEED_API_URL}?offset=${offset}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/atom+xml,application/xml,text/xml',
            }
        });

        console.log('  → 응답 상태:', response.status, response.statusText);
        console.log('  → 응답 헤더:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('  → 에러 응답:', errorText.substring(0, 500));
            throw new Error(`HTTP 오류! 상태: ${response.status}`);
        }

        console.log('  → XML 본문 읽는 중...');
        const xml = await response.text();
        console.log('  → XML 본문 길이:', xml.length);

        return xml;
    } catch (error) {
        if (error.message.includes('Failed to fetch')) {
            console.error('  ❌ 백엔드 서버에 연결할 수 없습니다!');
            console.error('  💡 server.js를 실행했는지 확인하세요: node server.js');
            throw new Error('백엔드 서버에 연결할 수 없습니다. server.js를 실행했는지 확인하세요.');
        }
        throw error;
    }
}

// Atom XML 파싱하여 커밋 정보 추출
function parseCommitsFromAtom(xml) {
    console.log('  → DOMParser로 XML 파싱 중...');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const commits = [];

    // Atom 피드의 entry 요소 추출
    console.log('  → Entry 검색...');
    const entries = doc.querySelectorAll('entry');
    console.log(`  → 찾은 entry 수: ${entries.length}`);

    entries.forEach((entry, idx) => {
        try {
            // title: 커밋 메시지
            const titleEl = entry.querySelector('title');
            const message = titleEl ? titleEl.textContent.trim() : '';

            // author: 작성자
            const authorEl = entry.querySelector('author name');
            const author = authorEl ? authorEl.textContent.trim() : '';

            // updated: 날짜
            const updatedEl = entry.querySelector('updated');
            const dateStr = updatedEl ? updatedEl.textContent.trim() : '';
            const date = dateStr ? new Date(dateStr).toLocaleString('ko-KR') : '';

            // id 또는 link에서 커밋 해시 추출
            const idEl = entry.querySelector('id');
            const linkEl = entry.querySelector('link[rel="alternate"]');

            let hash = '';
            if (linkEl && linkEl.getAttribute('href')) {
                const href = linkEl.getAttribute('href');
                const match = href.match(/id=([a-f0-9]+)/);
                if (match) {
                    hash = match[1];
                }
            }

            // 메시지가 없으면 스킵
            if (!message) {
                return;
            }

            // 버전 태그 추출
            const versionMatch = message.match(/Linux (6\.12\.\d+)/i) ||
                               message.match(/v(6\.12\.\d+)/i) ||
                               message.match(/(6\.12\.\d+)/);
            const version = versionMatch ? versionMatch[1] : null;

            commits.push({
                date,
                message,
                author,
                hash: hash || 'unknown',
                version,
                summary: generateSummary(message)
            });

            if (idx < 3) {
                console.log(`  → Entry #${idx + 1} 파싱 성공:`, message.substring(0, 60));
            }
        } catch (error) {
            console.error(`  ❌ Entry #${idx + 1} 파싱 에러:`, error);
        }
    });

    console.log(`  → 파싱 결과: ${commits.length}개 커밋`);

    return commits;
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

// 커밋 카테고리 분류
function categorizeCommit(message) {
    const lowerMessage = message.toLowerCase();

    // 1. CVE 취약점
    if (message.match(/CVE-\d{4}-\d+/i) || lowerMessage.includes('cve')) {
        return 'vulnerability';
    }

    // 2. 오류수정 (fix, bug)
    if (lowerMessage.includes('fix') || lowerMessage.includes('bug') ||
        lowerMessage.includes('revert')) {
        return 'bugfix';
    }

    // 3. 일반커밋 (나머지)
    return 'general';
}

// CVE 정보 추출
function extractCVE(message) {
    const cveMatch = message.match(/CVE-\d{4}-\d+/gi);
    return cveMatch ? cveMatch : [];
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

// 버전별 -> 카테고리별로 커밋 그룹화
function groupByVersion(commits) {
    // 1단계: 버전 릴리즈 찾기 (시간순으로 정렬)
    const versionReleases = commits
        .filter(commit => commit.version !== null)
        .sort((a, b) => {
            // 최신 버전이 앞에 오도록 정렬
            return b.version.localeCompare(a.version, undefined, { numeric: true });
        });

    console.log('  → 찾은 버전 릴리즈:', versionReleases.map(v => v.version));

    // 2단계: 각 커밋에 버전 할당 (릴리즈 사이의 커밋은 최근 버전에 속함)
    const versionMap = new Map();
    let currentVersion = versionReleases.length > 0 ? versionReleases[0].version : 'Other';

    commits.forEach((commit, index) => {
        // 버전 릴리즈를 만나면 currentVersion 업데이트
        if (commit.version !== null) {
            currentVersion = commit.version;
        }

        // 커밋에 버전 할당
        commit.assignedVersion = currentVersion;

        // 버전별로 그룹화
        if (!versionMap.has(currentVersion)) {
            versionMap.set(currentVersion, []);
        }
        versionMap.get(currentVersion).push(commit);
    });

    // 3단계: 각 버전 내에서 카테고리별로 분류
    const result = new Map();

    // 버전을 최신순으로 정렬
    const sortedVersions = [...versionMap.keys()].sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return b.localeCompare(a, undefined, { numeric: true });
    });

    sortedVersions.forEach(version => {
        const versionCommits = versionMap.get(version);
        const categoryMap = {
            vulnerability: [],
            bugfix: [],
            general: []
        };

        versionCommits.forEach(commit => {
            const category = categorizeCommit(commit.message);
            categoryMap[category].push(commit);

            // CVE 정보 추출하여 저장
            if (category === 'vulnerability') {
                commit.cveList = extractCVE(commit.message);
            }
        });

        result.set(version, categoryMap);
    });

    console.log('  → 버전별 카테고리 그룹화 완료');
    return result;
}

// 로그 표시 (버전 -> 카테고리 -> 커밋)
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

    groupedCommits.forEach((categoryMap, version) => {
        const totalCommits = categoryMap.vulnerability.length +
                           categoryMap.bugfix.length +
                           categoryMap.general.length;
        console.log(`    → 버전 "${version}" 렌더링 중... (${totalCommits}개 커밋)`);
        const versionGroup = createVersionGroup(version, categoryMap);
        logContainer.appendChild(versionGroup);
        totalRendered += totalCommits;
    });

    console.log(`  ✅ 총 ${totalRendered}개 커밋 렌더링 완료`);
}

// 버전 그룹 생성 (카테고리별로 구분)
function createVersionGroup(version, categoryMap) {
    const group = document.createElement('div');
    group.className = 'version-group';

    const totalCommits = categoryMap.vulnerability.length +
                        categoryMap.bugfix.length +
                        categoryMap.general.length;

    const header = document.createElement('div');
    header.className = 'version-header';
    header.innerHTML = `
        <h2>${version === 'Other' ? '기타 커밋' : 'v' + version}</h2>
        <span class="count">${totalCommits}개 커밋</span>
    `;

    const content = document.createElement('div');
    content.className = 'version-content';

    // 카테고리 순서: 취약점 -> 오류수정 -> 일반커밋
    const categories = [
        { key: 'vulnerability', title: '🔴 취약점', commits: categoryMap.vulnerability },
        { key: 'bugfix', title: '🔧 오류수정', commits: categoryMap.bugfix },
        { key: 'general', title: '📋 일반커밋', commits: categoryMap.general }
    ];

    categories.forEach(category => {
        if (category.commits.length > 0) {
            const categoryGroup = createCategoryGroup(category.title, category.commits, category.key);
            content.appendChild(categoryGroup);
        }
    });

    // 토글 기능
    header.addEventListener('click', () => {
        content.classList.toggle('collapsed');
    });

    group.appendChild(header);
    group.appendChild(content);

    return group;
}

// 카테고리 그룹 생성
function createCategoryGroup(title, commits, categoryKey) {
    const group = document.createElement('div');
    group.className = 'category-group';

    if (categoryKey === 'vulnerability') {
        group.classList.add('vulnerability-category');
    }

    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `
        <h3>${title}</h3>
        <span class="category-count">${commits.length}개</span>
    `;

    const content = document.createElement('div');
    content.className = 'category-content';

    commits.forEach(commit => {
        const commitEl = createCommitElement(commit, categoryKey === 'vulnerability');
        content.appendChild(commitEl);
    });

    // 토글 기능
    header.addEventListener('click', (e) => {
        e.stopPropagation(); // 버전 헤더 클릭 이벤트 전파 방지
        content.classList.toggle('collapsed');
    });

    group.appendChild(header);
    group.appendChild(content);

    return group;
}

// 개별 커밋 요소 생성
function createCommitElement(commit, isVulnerability = false) {
    const commitEl = document.createElement('div');
    commitEl.className = 'commit';

    if (isVulnerability) {
        commitEl.classList.add('vulnerability-commit');
    }

    let cveLabel = '';
    if (isVulnerability && commit.cveList && commit.cveList.length > 0) {
        cveLabel = `<span class="cve-label">[${commit.cveList.join(', ')}]</span> `;
    }

    commitEl.innerHTML = `
        <div class="commit-header">
            <span class="commit-hash">${commit.hash.substring(0, 12)}</span>
            <span class="commit-date">${commit.date}</span>
        </div>
        <div class="commit-author">작성자: ${commit.author}</div>
        <div class="commit-message">${cveLabel}${escapeHtml(commit.message)}</div>
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

function showLoadMoreBtn() {
    loadMoreContainer.classList.remove('hidden');
}

function hideLoadMoreBtn() {
    loadMoreContainer.classList.add('hidden');
}
