
document.addEventListener('DOMContentLoaded', () => {
    // --- Data ---
    const dddData = {
        "AC": ["68"], "AL": ["82"], "AP": ["96"], "AM": ["92", "97"], "BA": ["71", "73", "74", "75", "77"],
        "CE": ["85", "88"], "DF": ["61"], "ES": ["27", "28"], "GO": ["62", "64"], "MA": ["98", "99"],
        "MT": ["65", "66"], "MS": ["67"], "MG": ["31", "32", "33", "34", "35", "37", "38"], "PA": ["91", "93", "94"],
        "PB": ["83"], "PR": ["41", "42", "43", "44", "45", "46"], "PE": ["81", "87"], "PI": ["86", "89"],
        "RJ": ["21", "22", "24"], "RN": ["84"], "RS": ["51", "53", "54", "55"], "RO": ["69"], "RR": ["95"],
        "SC": ["47", "48", "49"], "SP": ["11", "12", "13", "14", "15", "16", "17", "18", "19"], "SE": ["79"], "TO": ["63"]
    };
    const states = {
        "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia", "CE": "Ceará",
        "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso",
        "MS": "Mato Grosso do Sul", "MG": "Minas Gerais", "PA": "Pará", "PB": "Paraíba", "PR": "Paraná",
        "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
        "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina",
        "SP": "São Paulo", "SE": "Sergipe", "TO": "Tocantins"
    };

    // --- Simple cache for BrasilAPI responses by DDD ---
    const dddCache = new Map(); // key: '11' -> {state, cities}

    // --- DOM Elements ---
    const tabsContainer = document.querySelector('.tabs');
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const resultContainer = document.getElementById('result-container');

    // CEP Search
    const cepInput = document.getElementById('cep-input');
    const searchCepBtn = document.getElementById('search-cep-btn');

    // Address Search
    const stateInput = document.getElementById('state-input');
    const cityInput = document.getElementById('city-input');
    const streetInput = document.getElementById('street-input');
    const searchAddressBtn = document.getElementById('search-address-btn');

    // DDD by State
    const stateSelect = document.getElementById('state-select');

    // DDD by City
    const stateCitySelect = document.getElementById('state-city-select');
    const cityDddInput = document.getElementById('city-ddd-input');
    const searchCityDddBtn = document.getElementById('search-city-ddd-btn');

    // --- Tab Switching Logic ---
    tabsContainer.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-link')) return;

        const tabId = e.target.dataset.tab;

        tabLinks.forEach(link => link.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        e.target.classList.add('active');
        document.getElementById(tabId).classList.add('active');

        clearResults();
    });

    // --- State Dropdown Population ---
    function populateStateSelect() {
        stateSelect.innerHTML = '<option value="">Selecione um estado...</option>';
        for (const [uf, name] of Object.entries(states)) {
            const option = document.createElement('option');
            option.value = uf;
            option.textContent = name;
            stateSelect.appendChild(option);
        }
    }
    function populateStateCitySelect() {
        stateCitySelect.innerHTML = '<option value="">Selecione um estado...</option>';
        for (const [uf, name] of Object.entries(states)) {
            const option = document.createElement('option');
            option.value = uf;
            option.textContent = name;
            stateCitySelect.appendChild(option);
        }
    }

    // --- Event Listeners ---
    if (searchCepBtn) searchCepBtn.addEventListener('click', handleCepSearch);
    if (searchAddressBtn) searchAddressBtn.addEventListener('click', handleAddressSearch);
    if (stateSelect) stateSelect.addEventListener('change', handleStateSelect);
    if (searchCityDddBtn) searchCityDddBtn.addEventListener('click', handleCityToDdd);

    // --- Search Handlers ---
    function handleCepSearch() {
        const cep = cepInput.value.replace(/\\D/g, '');
        if (cep.length !== 8) {
            displayError("Por favor, digite um CEP válido com 8 dígitos.");
            return;
        }
        fetch(`https://viacep.com.br/ws/${cep}/json/`)
            .then(handleFetchResponse)
            .then(data => {
                if (data.erro) {
                    displayError("CEP não encontrado. Verifique o número e tente novamente.");
                } else {
                    displayResults([data]);
                }
            })
            .catch(err => displayError(err.message));
    }

    function handleAddressSearch() {
        const uf = stateInput.value.trim().toUpperCase();
        const city = cityInput.value.trim();
        const street = streetInput.value.trim();

        if (uf.length !== 2 || !city || !street) {
            displayError("Por favor, preencha os campos UF (2 letras), Cidade e Rua.");
            return;
        }
        fetch(`https://viacep.com.br/ws/${uf}/${city}/${street}/json/`)
            .then(handleFetchResponse)
            .then(data => {
                if (!Array.isArray(data) || data.length === 0) {
                    displayError("Nenhum endereço encontrado com os dados fornecidos.");
                } else {
                    displayResults(data);
                }
            })
            .catch(err => displayError(err.message));
    }

    async function handleStateSelect() {
        const selectedUf = stateSelect.value;
        if (!selectedUf) {
            clearResults();
            return;
        }
        const ddds = dddData[selectedUf];
        const stateName = states[selectedUf];

        clearResults();

        const headerCard = document.createElement('div');
        headerCard.className = 'result-card';
        headerCard.innerHTML = `
            <h2>DDDs de ${stateName} (${selectedUf})</h2>
            <p><strong>DDDs:</strong> ${ddds.join(', ')}</p>
            <p>Veja abaixo as <em>cidades por DDD</em> (BrasilAPI).</p>
        `;
        resultContainer.appendChild(headerCard);

        for (const ddd of ddds) {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `<h2>DDD ${ddd}</h2><p><em>Carregando cidades…</em></p>`;
            resultContainer.appendChild(card);

            try {
                const info = await fetchCitiesByDdd(ddd);
                if (!info || !Array.isArray(info.cities) || info.cities.length === 0) {
                    card.innerHTML = `<h2>DDD ${ddd}</h2><p>Nenhuma cidade encontrada para este DDD.</p>`;
                    continue;
                }
                const cities = info.cities.slice().sort((a, b) => a.localeCompare(b, 'pt-BR'));
                const preview = cities.slice(0, 20);
                const hasMore = cities.length > preview.length;

                card.innerHTML = `
                    <h2>DDD ${ddd}</h2>
                    <p><strong>UF (API):</strong> ${info.state || selectedUf}</p>
                    <p><strong>Cidades (${cities.length}):</strong>
                        <span class="cities-list">${preview.join(', ')}</span>
                        ${hasMore ? ` <a href="#" class="toggle-cities" data-ddd="${ddd}">ver todas</a>` : ''}
                    </p>
                `;

                const link = card.querySelector('.toggle-cities');
                if (link) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        const span = card.querySelector('.cities-list');
                        const expanded = link.getAttribute('data-expanded') === '1';
                        span.textContent = expanded ? preview.join(', ') : cities.join(', ');
                        link.textContent = expanded ? 'ver todas' : 'ver menos';
                        link.setAttribute('data-expanded', expanded ? '0' : '1');
                    });
                }
            } catch (err) {
                card.innerHTML = `
                    <h2>DDD ${ddd}</h2>
                    <p style="color:#b00020"><strong>Erro:</strong> Não foi possível carregar as cidades agora.</p>
                    <p style="font-size:13px;opacity:.8">${(err && err.message) ? err.message : ''}</p>
                    <p style="font-size:13px">Teste a API: https://brasilapi.com.br/api/ddd/v1/${ddd}</p>
                `;
            }
        }

        resultContainer.style.display = 'block';
    }

    // --- New: City -> DDD search ---
    async function handleCityToDdd() {
        const uf = (stateCitySelect.value || '').trim().toUpperCase();
        const city = (cityDddInput.value || '').trim();
        if (!uf || !city) {
            displayError('Selecione o estado e informe a cidade.');
            return;
        }
        const ddds = dddData[uf] || [];
        if (ddds.length === 0) {
            displayError('Não há DDDs cadastrados para este estado.');
            return;
        }

        clearResults();
        const normalizedCity = normalize(city);

        const matches = [];
        for (const ddd of ddds) {
            try {
                const info = await fetchCitiesByDdd(ddd);
                const cities = (info && info.cities) ? info.cities : [];
                const found = cities.some(c => normalize(c) === normalizedCity);
                if (found) {
                    matches.push({ ddd, state: info.state, cities });
                }
            } catch (e) {
                // Ignora erro individual e continua
            }
        }

        if (matches.length === 0) {
            displayError(`Nenhum DDD encontrado para "${city}" em ${states[uf]} (${uf}).`);
            return;
        }

        // Monta resultado
        const card = document.createElement('div');
        card.className = 'result-card';
        const ddList = matches.map(m => m.ddd).join(', ');
        card.innerHTML = `
            <h2>DDD por Cidade</h2>
            <p><strong>Cidade:</strong> ${city}</p>
            <p><strong>Estado:</strong> ${states[uf]} (${uf})</p>
            <p><strong>DDD(s) encontrado(s):</strong> ${ddList}</p>
        `;
        resultContainer.appendChild(card);

        // Cards por DDD (opcional, para transparência)
        for (const m of matches) {
            const c = document.createElement('div');
            const citiesSorted = m.cities.slice().sort((a,b)=>a.localeCompare(b,'pt-BR'));
            c.className = 'result-card';
            c.innerHTML = `
                <h2>DDD ${m.ddd} — ${m.state}</h2>
                <p><strong>Cidades (${citiesSorted.length}):</strong> ${citiesSorted.join(', ')}</p>
            `;
            resultContainer.appendChild(c);
        }

        resultContainer.style.display = 'block';
    }

    // --- Helper Functions ---
    function handleFetchResponse(response) {
        if (!response.ok) throw new Error('Falha na comunicação com a API.');
        return response.json();
    }

    function clearResults() {
        resultContainer.innerHTML = '';
        resultContainer.style.display = 'none';
    }

    function displayError(message) {
        clearResults();
        resultContainer.innerHTML = `<div class="result-card"><h2>Erro</h2><p>${message}</p></div>`;
        resultContainer.style.display = 'block';
    }

    async function fetchCitiesByDdd(ddd) {
        if (dddCache.has(ddd)) return dddCache.get(ddd);
        const url = `https://brasilapi.com.br/api/ddd/v1/${ddd}`;
        const resp = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-store',
            headers: { 'Accept': 'application/json' }
        });
        if (!resp.ok) {
            const txt = await resp.text().catch(()=>'');
            throw new Error(`HTTP ${resp.status} ao consultar BrasilAPI. ${txt}`);
        }
        const data = await resp.json();
        dddCache.set(ddd, data);
        return data; // { state: "SP", cities: [...] }
    }

    function normalize(s) {
        return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }

    // --- Initializations ---
    populateStateSelect();
    if (stateCitySelect) populateStateCitySelect();
});