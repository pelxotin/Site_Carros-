const API_BASE = 'https://parallelum.com.br/fipe/api/v1/carros';
const DEFAULT_BRAND_CODE = '21'; // FIAT como padrão inicial
const MAX_MODELS_PER_LOAD = 5; // Reduzido para evitar rate limiting
const THEME_STORAGE_KEY = 'autoprime.theme';
const API_DELAY_MS = 500; // Delay entre requisições para evitar 429

const selectors = {
  screens: document.querySelectorAll('.screen'),
  navLinks: document.querySelectorAll('.nav-link'),
  filterForm: document.getElementById('filterForm'),
  clearFilters: document.getElementById('clearFilters'),
  filterBrand: document.getElementById('filterBrand'),
  filterModel: document.getElementById('filterModel'),
  filterModelSuggestions: document.getElementById('filterModelSuggestions'),
  filterYearMin: document.getElementById('filterYearMin'),
  filterYearMax: document.getElementById('filterYearMax'),
  filterPrice: document.getElementById('filterPrice'),
  filterPriceValue: document.getElementById('filterPriceValue'),
  filterTransmission: document.getElementById('filterTransmission'),
  filterFuel: document.getElementById('filterFuel'),
  filterCertified: document.getElementById('filterCertified'),
  inventoryGrid: document.getElementById('inventoryGrid'),
  inventoryFeedback: document.getElementById('inventoryFeedback'),
  inventoryCount: document.getElementById('inventoryCount'),
  sortSelect: document.getElementById('sortSelect'),
  toastContainer: document.getElementById('toastContainer'),
  listingForm: document.getElementById('listingForm'),
  listingPhotos: document.getElementById('listingPhotos'),
  photoPreview: document.getElementById('photoPreview'),
  listingSuccess: document.getElementById('listingSuccess'),
  galleryModal: document.getElementById('galleryModal'),
  galleryClose: document.getElementById('galleryClose'),
  galleryPrev: document.getElementById('galleryPrev'),
  galleryNext: document.getElementById('galleryNext'),
  galleryMainImage: document.getElementById('galleryMainImage'),
  galleryThumbs: document.getElementById('galleryThumbs'),
  galleryVehicleName: document.getElementById('galleryVehicleName'),
  galleryImageCounter: document.getElementById('galleryImageCounter'),
  vehicleDetailsModal: document.getElementById('vehicleDetailsModal'),
  vehicleDetailsClose: document.getElementById('vehicleDetailsClose'),
  vehicleDetailsContent: document.getElementById('vehicleDetailsContent'),
  viewGrid: document.getElementById('viewGrid'),
  viewList: document.getElementById('viewList'),
  returnForm: document.getElementById('returnForm'),
  returnAlert: document.getElementById('returnAlert'),
  testDriveForm: document.getElementById('testDriveForm'),
  testDriveConfirmation: document.getElementById('testDriveConfirmation'),
  testDriveDetails: document.getElementById('testDriveDetails'),
  testDriveList: document.getElementById('testDriveList'),
  garageList: document.getElementById('garageList'),
  themeToggle: document.getElementById('themeToggle'),
  loginBtn: document.getElementById('loginBtn'),
  signupBtn: document.getElementById('signupBtn'),
  loginModal: document.getElementById('loginModal'),
  signupModal: document.getElementById('signupModal'),
  closeLoginModal: document.getElementById('closeLoginModal'),
  closeSignupModal: document.getElementById('closeSignupModal'),
  loginForm: document.getElementById('loginForm'),
  signupForm: document.getElementById('signupForm'),
  switchToSignup: document.getElementById('switchToSignup'),
  switchToLogin: document.getElementById('switchToLogin'),
};

const state = {
  brands: [],
  inventory: [],
  filteredInventory: [],
  loadingInventory: false,
  cache: {
    models: new Map(),
    years: new Map(),
    vehicles: new Map(),
  },
  user: null,
  users: JSON.parse(localStorage.getItem('autoprime.users') || '[]'),
  userListings: JSON.parse(localStorage.getItem('autoprime.listings') || '[]'),
  savedVehicles: JSON.parse(localStorage.getItem('autoprime.savedVehicles') || '[]'),
};

const fallbackImages = [
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=900&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=900&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1549317661-bd32c8be0c19?w=900&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=900&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=900&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=900&h=600&fit=crop&auto=format',
];

function getCarImage(brand, model, year) {
  if (!brand || !model) {
    return fallbackImages[0];
  }
  
  // Normaliza marca e modelo para criar uma busca mais específica
  const normalizeBrand = (b) => {
    const brandMap = {
      'fiat': 'fiat',
      'chevrolet': 'chevrolet',
      'volkswagen': 'volkswagen',
      'ford': 'ford',
      'toyota': 'toyota',
      'honda': 'honda',
      'nissan': 'nissan',
      'hyundai': 'hyundai',
      'renault': 'renault',
      'peugeot': 'peugeot',
      'bmw': 'bmw',
      'mercedes': 'mercedes-benz',
      'audi': 'audi',
      'volvo': 'volvo',
      'mitsubishi': 'mitsubishi',
      'citroën': 'citroen',
      'citroen': 'citroen'
    };
    const normalized = b.toLowerCase().trim();
    return brandMap[normalized] || normalized.replace(/[^a-z0-9]/g, '');
  };
  
  const normalizeModel = (m) => {
    // Remove palavras comuns que não ajudam na busca
    const commonWords = ['modelo', 'versão', 'version', 'edition', 'edição'];
    let cleaned = m.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
    
    // Remove palavras comuns
    commonWords.forEach(word => {
      cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    });
    
    return cleaned
      .substring(0, 25)
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };
  
  const cleanBrand = normalizeBrand(brand);
  const cleanModel = normalizeModel(model);
  
  // Cria uma busca específica: marca + modelo + "car"
  // Tenta diferentes variações para melhorar os resultados
  let searchQuery = '';
  
  if (cleanModel && cleanModel !== 'car') {
    // Busca mais específica: marca + modelo
    searchQuery = `${cleanBrand} ${cleanModel} car`.trim();
  } else {
    // Se não tem modelo válido, busca apenas pela marca
    searchQuery = `${cleanBrand} car`.trim();
  }
  
  // Usa Unsplash Source API com query específica
  // Isso tentará buscar imagens relacionadas ao carro específico
  // Adiciona timestamp para evitar cache e garantir imagens diferentes
  const timestamp = Date.now();
  const unsplashUrl = `https://source.unsplash.com/900x600/?${encodeURIComponent(searchQuery)}&sig=${timestamp}`;
  
  return unsplashUrl;
}

// Carrossel do Hero
let heroCarouselIndex = 0;
let heroCarouselInterval = null;

function initHeroCarousel() {
  const slides = document.querySelectorAll('.hero__carousel-slide');
  const prevBtn = document.getElementById('heroCarouselPrev');
  const nextBtn = document.getElementById('heroCarouselNext');
  
  if (slides.length === 0) {
    console.warn('Nenhum slide encontrado no carrossel');
    return;
  }
  
  // Garante que a primeira imagem está visível
  slides.forEach((slide, index) => {
    if (index === 0) {
      slide.classList.add('hero__carousel-slide--active');
    } else {
      slide.classList.remove('hero__carousel-slide--active');
    }
  });
  
  // Cria indicadores
  const indicatorsContainer = document.getElementById('heroCarouselIndicators');
  if (indicatorsContainer) {
    indicatorsContainer.innerHTML = '';
    slides.forEach((_, index) => {
      const indicator = document.createElement('button');
      indicator.className = 'hero__carousel-indicator';
      if (index === 0) indicator.classList.add('hero__carousel-indicator--active');
      indicator.addEventListener('click', () => goToSlide(index));
      indicatorsContainer.appendChild(indicator);
    });
  }
  
  function goToSlide(index) {
    heroCarouselIndex = index;
    
    // Atualiza slides
    slides.forEach((slide, i) => {
      slide.classList.toggle('hero__carousel-slide--active', i === index);
    });
    
    // Atualiza indicadores
    document.querySelectorAll('.hero__carousel-indicator').forEach((indicator, i) => {
      indicator.classList.toggle('hero__carousel-indicator--active', i === index);
    });
    
    // Reinicia o intervalo
    resetCarouselInterval();
  }
  
  function nextSlide() {
    const nextIndex = (heroCarouselIndex + 1) % slides.length;
    goToSlide(nextIndex);
  }
  
  function prevSlide() {
    const prevIndex = (heroCarouselIndex - 1 + slides.length) % slides.length;
    goToSlide(prevIndex);
  }
  
  function resetCarouselInterval() {
    if (heroCarouselInterval) {
      clearInterval(heroCarouselInterval);
    }
    heroCarouselInterval = setInterval(nextSlide, 5000); // Troca a cada 5 segundos
  }
  
  // Event listeners
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      nextSlide();
    });
  }
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      prevSlide();
    });
  }
  
  // Pausa ao passar o mouse
  const carousel = document.getElementById('heroCarousel');
  if (carousel) {
    carousel.addEventListener('mouseenter', () => {
      if (heroCarouselInterval) {
        clearInterval(heroCarouselInterval);
        heroCarouselInterval = null;
      }
    });
    
    carousel.addEventListener('mouseleave', () => {
      resetCarouselInterval();
    });
  }
  
  // Preload das imagens para evitar bugs
  slides.forEach((slide) => {
    const img = slide.querySelector('img');
    if (img && !img.complete) {
      img.addEventListener('load', () => {
        img.style.opacity = '1';
      });
      img.addEventListener('error', () => {
        console.warn('Erro ao carregar imagem do carrossel:', img.src);
      });
    }
  });
  
  // Inicia o carrossel após um pequeno delay para garantir que as imagens carregaram
  setTimeout(() => {
    resetCarouselInterval();
  }, 500);
}

// Modal de Detalhes do Carro
function openVehicleDetails(vehicle) {
  if (!selectors.vehicleDetailsModal || !selectors.vehicleDetailsContent) return;
  
  const details = vehicle;
  
  selectors.vehicleDetailsContent.innerHTML = `
    <div class="vehicle-details__header">
      <div class="vehicle-details__image">
        <img src="${details.image || fallbackImages[0]}" alt="${details.model}" />
      </div>
      <div class="vehicle-details__info">
        <h2>${details.model || 'Veículo'}</h2>
        <p class="vehicle-details__price">${details.priceLabel || 'R$ 0,00'}</p>
        <div class="vehicle-details__badges">
          ${details.certified ? '<span class="badge badge--certified">Certificado AutoPrime</span>' : ''}
          <span class="badge">${details.year || 'N/A'}</span>
          <span class="badge">${details.fuel || 'Flex'}</span>
        </div>
      </div>
    </div>
    
    <div class="vehicle-details__specs">
      <h3>Especificações</h3>
      <div class="vehicle-details__grid">
        <div class="vehicle-details__spec">
          <strong>Marca:</strong>
          <span>${details.brand || 'N/A'}</span>
        </div>
        <div class="vehicle-details__spec">
          <strong>Modelo:</strong>
          <span>${details.model || 'N/A'}</span>
        </div>
        <div class="vehicle-details__spec">
          <strong>Ano:</strong>
          <span>${details.year || 'N/A'}</span>
        </div>
        <div class="vehicle-details__spec">
          <strong>Quilometragem:</strong>
          <span>${(details.mileage || 0).toLocaleString('pt-BR')} km</span>
        </div>
        <div class="vehicle-details__spec">
          <strong>Transmissão:</strong>
          <span>${details.transmission || 'N/A'}</span>
        </div>
        <div class="vehicle-details__spec">
          <strong>Combustível:</strong>
          <span>${details.fuel || 'Flex'}</span>
        </div>
        ${details.trim ? `
        <div class="vehicle-details__spec">
          <strong>Versão:</strong>
          <span>${details.trim}</span>
        </div>
        ` : ''}
        ${details.codeFipe ? `
        <div class="vehicle-details__spec">
          <strong>Código FIPE:</strong>
          <span>${details.codeFipe}</span>
        </div>
        ` : ''}
      </div>
    </div>
    
    ${details.description ? `
    <div class="vehicle-details__description">
      <h3>Descrição</h3>
      <p>${details.description}</p>
    </div>
    ` : ''}
    
    ${details.ownerName ? `
    <div class="vehicle-details__owner">
      <h3>Informações do Vendedor</h3>
      <div class="vehicle-details__owner-info">
        <p><strong>Nome:</strong> ${details.ownerName}</p>
        ${details.ownerPhone ? `<p><strong>Telefone:</strong> ${details.ownerPhone}</p>` : ''}
        ${details.ownerEmail ? `<p><strong>Email:</strong> ${details.ownerEmail}</p>` : ''}
      </div>
    </div>
    ` : ''}
    
    <div class="vehicle-details__actions">
      <button type="button" class="ghost-btn" data-action="save-details" data-id="${details.id}">
        Salvar na Garagem
      </button>
      <button type="button" class="primary-btn primary-btn--lg" data-action="contact-details" data-id="${details.id}">
        Entrar em Contato
      </button>
    </div>
  `;
  
  // Event listeners dos botões
  selectors.vehicleDetailsContent.querySelector('[data-action="save-details"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const vehicle = state.inventory.find(v => v.id === e.target.dataset.id);
    if (vehicle) {
      addVehicleToGarage(vehicle);
      showToast('Veículo salvo na sua garagem!', 'success');
    }
  });
  
  selectors.vehicleDetailsContent.querySelector('[data-action="contact-details"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const vehicle = state.inventory.find(v => v.id === e.target.dataset.id);
    if (vehicle) {
      if (vehicle.ownerPhone) {
        window.open(`https://wa.me/55${vehicle.ownerPhone.replace(/\D/g, '')}?text=Olá! Tenho interesse no ${vehicle.model}`, '_blank');
      } else {
        showToast('Telefone não disponível para este veículo.', 'info');
      }
    }
  });
  
  selectors.vehicleDetailsModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeVehicleDetails() {
  if (!selectors.vehicleDetailsModal) return;
  selectors.vehicleDetailsModal.hidden = true;
  document.body.style.overflow = '';
}


// Modo de Visualização
function initViewToggle() {
  if (!selectors.viewGrid || !selectors.viewList) return;
  
  const savedView = localStorage.getItem('autoprime.viewMode') || 'grid';
  setViewMode(savedView);
  
  selectors.viewGrid.addEventListener('click', () => setViewMode('grid'));
  selectors.viewList.addEventListener('click', () => setViewMode('list'));
}

function setViewMode(mode) {
  const grid = selectors.inventoryGrid;
  if (!grid) return;
  
  if (mode === 'list') {
    grid.classList.add('inventory__grid--list');
    selectors.viewGrid?.classList.remove('view-toggle__btn--active');
    selectors.viewList?.classList.add('view-toggle__btn--active');
  } else {
    grid.classList.remove('inventory__grid--list');
    selectors.viewGrid?.classList.add('view-toggle__btn--active');
    selectors.viewList?.classList.remove('view-toggle__btn--active');
  }
  
  localStorage.setItem('autoprime.viewMode', mode);
}

// Filtros Salvos
function saveFilters() {
  if (!selectors.filterForm) return;
  const formData = new FormData(selectors.filterForm);
  const filters = {};
  
  for (const [key, value] of formData.entries()) {
    if (value) filters[key] = value;
  }
  
  if (selectors.filterCertified?.checked) {
    filters.certified = true;
  }
  
  localStorage.setItem('autoprime.savedFilters', JSON.stringify(filters));
}

function loadSavedFilters() {
  const saved = localStorage.getItem('autoprime.savedFilters');
  if (!saved || !selectors.filterForm) return;
  
  try {
    const filters = JSON.parse(saved);
    Object.keys(filters).forEach(key => {
      const input = selectors.filterForm.querySelector(`[name="${key}"]`);
      if (input) {
        if (input.type === 'checkbox') {
          input.checked = filters[key];
        } else {
          input.value = filters[key];
        }
      }
    });
    
    if (filters.certified && selectors.filterCertified) {
      selectors.filterCertified.checked = true;
    }
    
    // Aplica os filtros salvos
    setTimeout(() => {
      selectors.filterBrand?.dispatchEvent(new Event('change'));
      applyFilters();
    }, 100);
  } catch (e) {
    console.warn('Erro ao carregar filtros salvos:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initFilters();
  initHeroCarousel();
  initForms();
  initAuth();
  renderGarage();
  initViewToggle();
  loadSavedFilters();
  
  // Salva filtros quando mudarem
  selectors.filterForm?.addEventListener('change', saveFilters);
  
  // Fecha modal de detalhes
  selectors.vehicleDetailsClose?.addEventListener('click', closeVehicleDetails);
  selectors.vehicleDetailsModal?.querySelector('.vehicle-details-modal__overlay')?.addEventListener('click', closeVehicleDetails);
  
  // Fecha com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectors.vehicleDetailsModal && !selectors.vehicleDetailsModal.hidden) {
      closeVehicleDetails();
    }
  });
  loadBrands().catch((error) => {
    console.error(error);
    setInventoryFeedback(
      'error',
      'Não foi possível carregar os carros agora.',
      'Verifique sua conexão e tente novamente em instantes.'
    );
  });
});

function initTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const initialTheme = storedTheme || (prefersDark ? 'dark' : 'light');
  applyTheme(initialTheme, false);

  selectors.themeToggle?.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
    applyTheme(nextTheme, true);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      applyTheme(event.matches ? 'dark' : 'light', false);
    }
  });
}

function applyTheme(theme, persist = true) {
  if (theme === 'dark') {
    document.body.classList.add('theme-dark');
  } else {
    document.body.classList.remove('theme-dark');
  }

  if (persist) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  updateThemeToggle(theme);
}

function updateThemeToggle(theme) {
  if (!selectors.themeToggle) return;
  selectors.themeToggle.dataset.theme = theme;
  selectors.themeToggle.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'
  );
}

function initNavigation() {
  selectors.navLinks.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      selectors.navLinks.forEach((link) => link.classList.toggle('active', link === btn));
      selectors.screens.forEach((screen) =>
        screen.classList.toggle('screen--active', screen.dataset.screen === target)
      );
      
      // Atualiza perfil quando navega para a página de perfil
      if (target === 'perfil') {
        updateProfile();
        renderGarage();
      }
    });
  });
}

function initFilters() {
  if (selectors.filterPrice) {
    selectors.filterPriceValue.textContent = `Até ${formatCurrency(selectors.filterPrice.value)}`;
    selectors.filterPrice.addEventListener('input', (event) => {
      selectors.filterPriceValue.textContent = `Até ${formatCurrency(event.target.value)}`;
      applyFilters();
    });
  }

  if (selectors.filterForm) {
    selectors.filterForm.addEventListener('input', debounce(applyFilters, 180));
  }

  selectors.filterBrand?.addEventListener('change', async () => {
    const selectedBrand = selectors.filterBrand.value;
    if (!selectedBrand) {
      resetModelSuggestions();
      // Se não há marca selecionada, mostra apenas anúncios do usuário
      state.inventory = [...state.userListings];
      state.loadingInventory = false;
      applyFilters();
      return;
    }
    try {
      await updateModelsForBrand(selectedBrand);
      await loadInventoryForBrand(selectedBrand);
    } catch (error) {
      console.error('Erro ao carregar marca:', error);
      setInventoryFeedback(
        'error',
        'Erro ao carregar veículos desta marca.',
        'Tente novamente em alguns instantes.'
      );
    }
  });

  selectors.sortSelect?.addEventListener('change', () => {
    state.filteredInventory = sortVehicles(state.filteredInventory, selectors.sortSelect.value);
    renderInventory();
  });

  selectors.clearFilters?.addEventListener('click', () => {
    selectors.filterForm?.reset();
    selectors.filterBrand?.dispatchEvent(new Event('change'));
    selectors.filterPriceValue.textContent = `Até ${formatCurrency(selectors.filterPrice.value)}`;
    applyFilters();
    showToast('Filtros limpos com sucesso.');
  });
}

function initForms() {
  // Preview de fotos no formulário
  selectors.listingPhotos?.addEventListener('change', (event) => {
    const files = Array.from(event.target.files);
    if (!selectors.photoPreview) return;
    
    selectors.photoPreview.innerHTML = '';
    
    files.slice(0, 10).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = 'Preview';
        selectors.photoPreview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  });

  selectors.listingForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    // Processa as imagens enviadas
    let mainImage = getCarImage(formData.get('brand'), formData.get('model'), formData.get('year'));
    const photoFiles = selectors.listingPhotos?.files;
    
    if (photoFiles && photoFiles.length > 0) {
      // Usa a primeira imagem enviada como imagem principal
      const firstPhoto = photoFiles[0];
      const reader = new FileReader();
      mainImage = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(firstPhoto);
      });
    }
    
    const listing = {
      id: `listing-${Date.now()}`,
      brand: formData.get('brand'),
      model: formData.get('model'),
      year: parseInt(formData.get('year')),
      mileage: parseInt(formData.get('mileage')),
      price: parseFloat(formData.get('price')),
      priceLabel: formatCurrency(formData.get('price')),
      priceNumber: parseFloat(formData.get('price')),
      transmission: formData.get('transmission'),
      fuel: formData.get('fuel'),
      trim: formData.get('trim'),
      description: formData.get('description'),
      ownerName: formData.get('ownerName'),
      ownerEmail: formData.get('ownerEmail'),
      ownerPhone: formData.get('ownerPhone'),
      image: mainImage,
      certified: false,
      source: 'user',
      createdAt: new Date().toISOString(),
    };

    state.userListings.push(listing);
    localStorage.setItem('autoprime.listings', JSON.stringify(state.userListings));
    
    // Adiciona à vitrine imediatamente
    state.inventory.push(listing);
    applyFilters();
    
    selectors.listingForm.reset();
    if (selectors.photoPreview) selectors.photoPreview.innerHTML = '';
    selectors.listingSuccess.hidden = false;
    showToast('Seu anúncio foi publicado e já está visível na vitrine!', 'success');
    setTimeout(() => {
      selectors.listingSuccess.hidden = true;
    }, 6000);
  });

  selectors.returnForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(selectors.returnForm);
    selectors.returnAlert.textContent = `Solicitação registrada para o pedido ${formData.get(
      'orderId'
    )}. Nossa equipe entrará em contato em até 1 dia útil.`;
    selectors.returnAlert.hidden = false;
    showToast('Processo de devolução iniciado com sucesso.', 'info');
    selectors.returnForm.reset();
    setTimeout(() => {
      selectors.returnAlert.hidden = true;
    }, 6000);
  });

  selectors.testDriveForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(selectors.testDriveForm);
    const vehicle = formData.get('vehicle');
    const date = new Date(`${formData.get('date')}T${formData.get('time')}`);
    const formattedDate = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    const formattedTime = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    selectors.testDriveDetails.textContent = `${vehicle} • ${formattedDate} às ${formattedTime}. Nossa equipe confirmará o endereço em breve.`;
    selectors.testDriveConfirmation.hidden = false;

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = formattedDate;

    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = vehicle;
    const subtitle = document.createElement('small');
    subtitle.textContent = `${formattedDate} às ${formattedTime} | Unidade AutoPrime`;
    info.append(title, subtitle);

    const listItem = document.createElement('li');
    listItem.append(badge, info);

    selectors.testDriveList?.prepend(listItem);
    showToast('Test-drive agendado com sucesso!', 'success');
    selectors.testDriveForm.reset();
  });
}

function initAuth() {
  const savedUser = localStorage.getItem('autoprime.currentUser');
  if (savedUser) {
    const userData = JSON.parse(savedUser);
    const fullUser = state.users.find((u) => u.email === userData.email);
    if (fullUser) {
      state.user = { ...fullUser, password: undefined };
      updateAuthUI();
      updateProfile();
    }
  }

  selectors.loginBtn?.addEventListener('click', () => {
    openLoginModal();
  });

  selectors.signupBtn?.addEventListener('click', () => {
    openSignupModal();
  });

  selectors.closeLoginModal?.addEventListener('click', closeLoginModal);
  selectors.closeSignupModal?.addEventListener('click', closeSignupModal);
  selectors.loginModal?.querySelector('.modal__overlay')?.addEventListener('click', closeLoginModal);
  selectors.signupModal?.querySelector('.modal__overlay')?.addEventListener('click', closeSignupModal);

  selectors.switchToSignup?.addEventListener('click', () => {
    closeLoginModal();
    setTimeout(() => openSignupModal(), 200);
  });

  selectors.switchToLogin?.addEventListener('click', () => {
    closeSignupModal();
    setTimeout(() => openLoginModal(), 200);
  });

  selectors.loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    const user = state.users.find((u) => u.email === email && u.password === password);
    if (user) {
      state.user = { ...user, password: undefined };
      localStorage.setItem('autoprime.currentUser', JSON.stringify(state.user));
      updateAuthUI();
      updateProfile();
      closeLoginModal();
      showToast(`Bem-vindo de volta, ${user.name}!`, 'success');
    } else {
      showToast('E-mail ou senha incorretos. Tente novamente.', 'error');
    }
  });

  selectors.signupForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const email = formData.get('email');
    const phone = formData.get('phone');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    if (password !== confirmPassword) {
      showToast('As senhas não coincidem. Tente novamente.', 'error');
      return;
    }

    if (state.users.some((u) => u.email === email)) {
      showToast('Este e-mail já está cadastrado. Faça login ou use outro e-mail.', 'error');
      return;
    }

    const newUser = { name, email, phone, password };
    state.users.push(newUser);
    localStorage.setItem('autoprime.users', JSON.stringify(state.users));

    state.user = { ...newUser, password: undefined };
    localStorage.setItem('autoprime.currentUser', JSON.stringify(state.user));
    updateAuthUI();
    updateProfile();
    closeSignupModal();
    showToast(`Conta criada com sucesso! Bem-vindo, ${name}!`, 'success');
  });
}

function openLoginModal() {
  if (selectors.loginModal) {
    selectors.loginModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
}

function closeLoginModal() {
  if (selectors.loginModal) {
    selectors.loginModal.hidden = true;
    selectors.loginForm?.reset();
    document.body.style.overflow = '';
  }
}

function openSignupModal() {
  if (selectors.signupModal) {
    selectors.signupModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
}

function closeSignupModal() {
  if (selectors.signupModal) {
    selectors.signupModal.hidden = true;
    selectors.signupForm?.reset();
    document.body.style.overflow = '';
  }
}

function updateProfile() {
  const profileName = document.getElementById('profileName');
  const profileInfo = document.getElementById('profileInfo');
  const profileInitials = document.getElementById('profileInitials');
  const profileBadges = document.getElementById('profileBadges');
  const profileAvatar = document.querySelector('.profile__avatar');
  const prefsList = document.querySelector('.profile__prefs');

  if (!state.user) {
    if (profileName) profileName.textContent = 'Usuário';
    if (profileInfo) profileInfo.textContent = 'Faça login para ver seu perfil';
    if (profileInitials) profileInitials.textContent = 'U';
    if (profileBadges) {
      profileBadges.innerHTML = '<span class="badge">Visitante</span>';
    }
    if (profileAvatar) {
      profileAvatar.style.display = 'grid';
    }
    return;
  }

  if (profileName) {
    profileName.textContent = state.user.name;
  }

  if (profileInfo) {
    const joinDate = new Date().getFullYear() - 1;
    profileInfo.textContent = `Membro desde ${joinDate} • Plano Prime`;
  }

  if (profileInitials) {
    const initials = state.user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    profileInitials.textContent = initials;
  }

  if (profileBadges) {
    const savedCount = state.savedVehicles.length;
    profileBadges.innerHTML = `
      <span class="badge badge--primary">Trust Score 4.9</span>
      <span class="badge">${savedCount > 0 ? 'Garagem ativa' : 'Sem veículos salvos'}</span>
    `;
  }

  // Atualiza estatísticas
  const statsSaved = document.querySelector('.profile__stats strong');
  const statsContainer = document.querySelector('.profile__stats');
  if (statsContainer) {
    const savedCount = state.savedVehicles.length;
    const listingsCount = state.userListings.filter(l => l.ownerEmail === state.user.email).length;
    if (statsContainer.children[0] && statsContainer.children[0].querySelector('strong')) {
      statsContainer.children[0].querySelector('strong').textContent = savedCount.toString().padStart(2, '0');
    }
  }

  if (profileAvatar) {
    profileAvatar.style.display = 'grid';
  }

  if (prefsList && state.user.phone) {
    // Remove telefone existente se houver
    const existingPhone = prefsList.querySelector('li[data-phone]');
    if (existingPhone) {
      existingPhone.remove();
    }
    
    // Adiciona telefone
    const phoneItem = document.createElement('li');
    phoneItem.setAttribute('data-phone', 'true');
    phoneItem.innerHTML = `<strong>Telefone:</strong> ${state.user.phone}`;
    prefsList.appendChild(phoneItem);
  }
}

function updateAuthUI() {
  if (state.user) {
    if (selectors.loginBtn) {
      selectors.loginBtn.textContent = state.user.name.split(' ')[0];
      selectors.loginBtn.classList.add('primary-btn');
      selectors.loginBtn.classList.remove('ghost-btn');
    }
    if (selectors.signupBtn) {
      selectors.signupBtn.textContent = 'Sair';
      selectors.signupBtn.onclick = () => {
        state.user = null;
        localStorage.removeItem('autoprime.currentUser');
        updateAuthUI();
        showToast('Você saiu da sua conta.', 'info');
      };
    }
  } else {
    if (selectors.loginBtn) {
      selectors.loginBtn.textContent = 'Entrar';
      selectors.loginBtn.classList.remove('primary-btn');
      selectors.loginBtn.classList.add('ghost-btn');
      selectors.loginBtn.onclick = () => openLoginModal();
    }
    if (selectors.signupBtn) {
      selectors.signupBtn.textContent = 'Criar conta';
      selectors.signupBtn.onclick = () => openSignupModal();
    }
  }
}

async function loadBrands() {
  setInventoryFeedback('loading', 'Carregando vitrine inteligente', 'Consultando a Tabela FIPE...');
  
  // Tenta carregar do cache primeiro
  const cachedBrands = localStorage.getItem('autoprime.brands');
  if (cachedBrands) {
    try {
      const brands = JSON.parse(cachedBrands);
      const cacheTime = parseInt(localStorage.getItem('autoprime.brands.time') || '0');
      const now = Date.now();
      // Cache válido por 1 hora
      if (now - cacheTime < 3600000 && Array.isArray(brands) && brands.length > 0) {
        console.log('📦 Usando marcas do cache');
        state.brands = brands;
        populateBrandSelect();
        const brandToLoad =
          state.brands.find((brand) => brand.codigo === DEFAULT_BRAND_CODE)?.codigo ||
          state.brands[0]?.codigo;
        if (brandToLoad) {
          selectors.filterBrand.value = brandToLoad;
          await updateModelsForBrand(brandToLoad);
          await loadInventoryForBrand(brandToLoad);
        } else {
          state.inventory = [...state.userListings];
          state.loadingInventory = false;
          applyFilters();
        }
        return; // Usa cache, não precisa buscar da API
      }
    } catch (e) {
      console.warn('Erro ao ler cache de marcas:', e);
    }
  }
  
  try {
    const brands = await fetchJSON(`${API_BASE}/marcas`);
    
    // Valida se brands é um array válido
    if (!Array.isArray(brands) || brands.length === 0) {
      throw new Error('Resposta da API inválida: não é um array ou está vazio');
    }
    
    state.brands = brands.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    
    // Salva no cache
    localStorage.setItem('autoprime.brands', JSON.stringify(state.brands));
    localStorage.setItem('autoprime.brands.time', Date.now().toString());
    
    populateBrandSelect();
    const brandToLoad =
      state.brands.find((brand) => brand.codigo === DEFAULT_BRAND_CODE)?.codigo ||
      state.brands[0]?.codigo;
    if (brandToLoad) {
      selectors.filterBrand.value = brandToLoad;
      await updateModelsForBrand(brandToLoad);
      await loadInventoryForBrand(brandToLoad);
    } else {
      // Se não houver marca, ainda mostra os anúncios do usuário
      state.inventory = [...state.userListings];
      state.loadingInventory = false;
      applyFilters();
    }
  } catch (error) {
    console.error('❌ Erro ao carregar marcas:', error);
    
    // Tenta usar cache mesmo se expirado
    if (cachedBrands) {
      try {
        const brands = JSON.parse(cachedBrands);
        if (Array.isArray(brands) && brands.length > 0) {
          console.log('📦 Usando cache expirado como fallback');
          state.brands = brands;
          populateBrandSelect();
          setInventoryFeedback(
            'warning',
            'Usando dados em cache',
            'A API está temporariamente indisponível. Alguns dados podem estar desatualizados.'
          );
          return;
        }
      } catch (e) {
        console.warn('Erro ao usar cache expirado:', e);
      }
    }
    
    // Se não tem cache, mostra mensagem de erro
    setInventoryFeedback(
      'error',
      'Erro ao carregar marcas',
      'A API está temporariamente indisponível. Tente novamente em alguns instantes.'
    );
    
    // Mesmo com erro, mostra os anúncios do usuário
    state.inventory = [...state.userListings];
    state.loadingInventory = false;
    applyFilters();
  }
}

function populateBrandSelect() {
  if (!selectors.filterBrand) return;
  selectors.filterBrand.innerHTML = '<option value="">Todas</option>';
  const fragment = document.createDocumentFragment();
  state.brands.forEach((brand) => {
    const option = document.createElement('option');
    option.value = brand.codigo;
    option.textContent = brand.nome;
    fragment.appendChild(option);
  });
  selectors.filterBrand.appendChild(fragment);
}

async function updateModelsForBrand(brandCode) {
  if (!brandCode) {
    resetModelSuggestions();
    return;
  }

  const models = await fetchModels(brandCode);
  selectors.filterModelSuggestions.innerHTML = '';
  const fragment = document.createDocumentFragment();
  models.slice(0, 30).forEach((model) => {
    const option = document.createElement('option');
    option.value = model.nome;
    fragment.appendChild(option);
  });
  selectors.filterModelSuggestions.appendChild(fragment);
}

function resetModelSuggestions() {
  if (selectors.filterModelSuggestions) {
    selectors.filterModelSuggestions.innerHTML = '';
  }
}

async function loadInventoryForBrand(brandCode) {
  state.loadingInventory = true;
  setInventoryFeedback('loading', 'Atualizando a vitrine', 'Estamos buscando os modelos mais desejados.');

  const selectedBrand =
    state.brands.find((brand) => brand.codigo === brandCode) || state.brands[0];

  if (!selectedBrand) {
    setInventoryFeedback('empty', 'Nenhuma marca encontrada.', 'Tente novamente mais tarde.');
    state.inventory = [...state.userListings];
    state.loadingInventory = false;
    applyFilters();
    return;
  }

  try {
    const models = await fetchModels(selectedBrand.codigo);
    const topModels = models.slice(0, MAX_MODELS_PER_LOAD);

    console.log(`Carregando ${topModels.length} modelos da marca ${selectedBrand.nome}...`);

    // Carrega veículos sequencialmente com delay para evitar rate limiting
    const vehicles = [];
    for (let i = 0; i < topModels.length; i++) {
      const model = topModels[i];
      try {
        // Adiciona delay entre requisições (exceto a primeira)
        if (i > 0) {
          await delay(API_DELAY_MS);
        }
        const vehicle = await fetchVehicleDetail(selectedBrand.codigo, model, i);
        if (vehicle) {
          vehicles.push(vehicle);
        }
      } catch (error) {
        console.warn(`Erro ao carregar veículo ${model.nome}:`, error);
        // Continua tentando os próximos mesmo se um falhar
      }
    }

    const validVehicles = vehicles.filter(Boolean);
    console.log(`✅ Carregados ${validVehicles.length} veículos da API`);
    console.log(`📋 Anúncios do usuário: ${state.userListings.length}`);
    
    // Debug: mostra os primeiros veículos carregados
    if (validVehicles.length > 0) {
      console.log('🔍 Primeiro veículo da API:', {
        brand: validVehicles[0].brand,
        model: validVehicles[0].model,
        year: validVehicles[0].year,
        source: validVehicles[0].source
      });
      console.log('🔍 Todos os veículos da API:', validVehicles.map(v => `${v.brand} ${v.model}`));
    } else {
      console.warn('⚠️ NENHUM veículo válido foi carregado da API!');
      console.log('Veículos brutos (antes do filter):', vehicles);
    }

    // Combina veículos da API com anúncios do usuário
    // IMPORTANTE: Mantém a marca correta nos veículos da API
    state.inventory = [...validVehicles, ...state.userListings];
    state.loadingInventory = false;

    console.log(`📦 Total no inventário: ${state.inventory.length} veículos`);
    console.log(`   - Da API: ${validVehicles.length}`);
    console.log(`   - Do usuário: ${state.userListings.length}`);
    console.log(`🔍 Aplicando filtros...`);
    console.log(`   Marca selecionada: ${selectedBrand.nome} (código: ${brandCode})`);

    if (!state.inventory.length) {
      setInventoryFeedback(
        'empty',
        'Ainda não temos carros dessa marca.',
        'Selecione outra marca ou tente novamente mais tarde.'
      );
    } else {
      clearInventoryFeedback();
    }

    // Garante que os filtros são aplicados e os carros são renderizados
    applyFilters();
    
    console.log(`✅ Filtros aplicados. Veículos filtrados: ${state.filteredInventory.length}`);
    if (state.filteredInventory.length > 0) {
      console.log('🔍 Primeiros veículos filtrados:', state.filteredInventory.slice(0, 3).map(v => `${v.brand} ${v.model} (${v.source})`));
    } else {
      console.warn('⚠️ NENHUM veículo passou pelos filtros!');
    }
  } catch (error) {
    console.error('Erro ao carregar inventário:', error);
    state.loadingInventory = false;
    setInventoryFeedback(
      'error',
      'Erro ao carregar veículos.',
      'Tente novamente em alguns instantes.'
    );
    // Ainda mostra os anúncios do usuário mesmo se a API falhar
    state.inventory = [...state.userListings];
    applyFilters();
  }
}

async function fetchModels(brandCode) {
  if (state.cache.models.has(brandCode)) {
    return state.cache.models.get(brandCode);
  }
  const { modelos } = await fetchJSON(`${API_BASE}/marcas/${brandCode}/modelos`);
  state.cache.models.set(brandCode, modelos);
  return modelos;
}

async function fetchVehicleDetail(brandCode, model, index) {
  const yearsKey = `${brandCode}-${model.codigo}`;
  let years = state.cache.years.get(yearsKey);
  if (!years) {
    // Adiciona pequeno delay antes de buscar anos
    await delay(API_DELAY_MS);
    const response = await fetchJSON(`${API_BASE}/marcas/${brandCode}/modelos/${model.codigo}/anos`);
    years = response;
    state.cache.years.set(yearsKey, years);
  }

  const preferredYear = choosePreferredYear(years);
  if (!preferredYear) return null;

  const vehicleKey = `${brandCode}-${model.codigo}-${preferredYear.codigo}`;
  if (state.cache.vehicles.has(vehicleKey)) {
    return state.cache.vehicles.get(vehicleKey);
  }

  // Adiciona delay antes de buscar detalhes
  await delay(API_DELAY_MS);
  const detail = await fetchJSON(
    `${API_BASE}/marcas/${brandCode}/modelos/${model.codigo}/anos/${preferredYear.codigo}`
  );

  const formatted = formatVehicle(detail, model.nome, index);
  state.cache.vehicles.set(vehicleKey, formatted);
  return formatted;
}

function choosePreferredYear(years) {
  if (!Array.isArray(years) || !years.length) return null;
  const priorityList = [
    '2025-5',
    '2025-3',
    '2024-5',
    '2024-3',
    '2023-5',
    '2023-3',
    '2022-5',
    '2022-3',
    '32000-5',
    '32000-3',
  ];

  for (const code of priorityList) {
    const match = years.find((year) => year.codigo === code);
    if (match) return match;
  }

  return years[0];
}

function formatVehicle(detail, modelName, index = 0) {
  if (!detail || !detail.Marca || !detail.Modelo) {
    console.warn('⚠️ Detalhes do veículo inválidos:', detail);
    return null;
  }
  
  const priceNumber = parseCurrency(detail.Valor);
  const carImage = getCarImage(detail.Marca, detail.Modelo, detail.AnoModelo);
  const mileage = generateMileage(detail.AnoModelo);
  const transmission = inferTransmission(modelName);
  const id = `${detail.CodigoFipe}-${detail.AnoModelo}`;

  const vehicle = {
    id,
    brand: detail.Marca,
    model: detail.Modelo,
    modelName,
    year: detail.AnoModelo,
    priceLabel: detail.Valor,
    priceNumber,
    fuel: formatFuel(detail.Combustivel),
    reference: detail.MesReferencia,
    codeFipe: detail.CodigoFipe,
    image: carImage,
    mileage,
    transmission,
    certified: isCertified(detail.CodigoFipe),
    source: 'fipe',
  };
  
  console.log(`✅ Veículo formatado: ${vehicle.brand} ${vehicle.model} (${vehicle.year}) - Imagem: ${vehicle.image.substring(0, 50)}...`);
  
  return vehicle;
}

function generateMileage(year) {
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - Number(year));
  const base = Math.random() * 4000 + 12000;
  return Math.round(base * Math.max(1, age));
}

function inferTransmission(modelName = '') {
  const normalized = modelName.toLowerCase();
  if (normalized.includes('aut') || normalized.includes('cvt') || normalized.includes('gsr')) {
    return 'Automático';
  }
  return 'Manual';
}

function formatFuel(fuel) {
  if (!fuel) return 'Flex';
  const normalized = fuel.toLowerCase();
  if (normalized.includes('diesel')) return 'Diesel';
  if (normalized.includes('híbr') || normalized.includes('hibr')) return 'Híbrido';
  if (normalized.includes('elétr') || normalized.includes('elect')) return 'Elétrico';
  if (normalized.includes('álcool') || normalized.includes('alcool')) return 'Álcool';
  if (normalized.includes('gasolina')) return 'Gasolina';
  if (normalized.includes('flex')) return 'Flex';
  return fuel;
}

function isCertified(codeFipe) {
  const numeric = Number(String(codeFipe).replace(/\D/g, ''));
  return numeric % 2 === 0;
}

function applyFilters() {
  // Se não há inventário, apenas renderiza (mostra mensagem vazia)
  if (!state.inventory || state.inventory.length === 0) {
    state.filteredInventory = [];
    renderInventory();
    return;
  }

  const brandFilter = selectors.filterBrand?.value;
  const modelFilter = selectors.filterModel?.value?.trim().toLowerCase();
  const yearMin = Number(selectors.filterYearMin?.value) || 1990;
  const yearMax = Number(selectors.filterYearMax?.value) || new Date().getFullYear();
  const priceMax = Number(selectors.filterPrice?.value) || Infinity;
  const transmissionFilter = selectors.filterTransmission?.value;
  const fuelFilter = selectors.filterFuel?.value;
  const certifiedOnly = selectors.filterCertified?.checked;

  console.log(`🔍 Filtrando ${state.inventory.length} veículos...`);
  console.log(`   Filtro de marca: ${brandFilter || 'nenhum'}`);
  
  let filteredCount = 0;
  let rejectedByBrand = 0;
  
  const filtered = state.inventory.filter((vehicle) => {
    if (!vehicle || !vehicle.model) {
      console.warn('⚠️ Veículo inválido ignorado:', vehicle);
      return false;
    }
    
    // Filtro de marca: compara o nome da marca (case-insensitive e sem acentos)
    if (brandFilter) {
      const brandName = getBrandNameByCode(brandFilter);
      if (brandName) {
        const vehicleBrand = normalizeBrandName(vehicle.brand || '');
        const filterBrand = normalizeBrandName(brandName);
        
        // Debug detalhado para os primeiros veículos
        if (filteredCount < 3) {
          console.log(`   Veículo: ${vehicle.brand} ${vehicle.model} (${vehicle.source})`);
          console.log(`     - Marca do veículo normalizada: "${vehicleBrand}"`);
          console.log(`     - Marca do filtro normalizada: "${filterBrand}"`);
          console.log(`     - Match: ${vehicleBrand === filterBrand ? '✅' : '❌'}`);
        }
        
        // Compara as marcas normalizadas
        if (vehicleBrand !== filterBrand) {
          rejectedByBrand++;
          return false;
        }
      } else {
        // Se não encontrou a marca no código, filtra por código direto (para anúncios do usuário)
        if (vehicle.brandCode && vehicle.brandCode !== brandFilter) {
          rejectedByBrand++;
          return false;
        }
      }
    }
    
    filteredCount++;
    
    if (modelFilter && !vehicle.model.toLowerCase().includes(modelFilter)) {
      return false;
    }
    if (vehicle.year && (vehicle.year < yearMin || vehicle.year > yearMax)) {
      return false;
    }
    if (vehicle.priceNumber && vehicle.priceNumber > priceMax) {
      return false;
    }
    if (transmissionFilter && vehicle.transmission !== transmissionFilter) {
      return false;
    }
    if (fuelFilter && vehicle.fuel !== fuelFilter) {
      return false;
    }
    if (certifiedOnly && !vehicle.certified) {
      return false;
    }
    return true;
  });

  console.log(`   ✅ Veículos que passaram no filtro de marca: ${filteredCount}`);
  console.log(`   ❌ Veículos rejeitados por marca: ${rejectedByBrand}`);
  
  state.filteredInventory = sortVehicles(filtered, selectors.sortSelect?.value);
  console.log(`   📊 Total após ordenação: ${state.filteredInventory.length} veículos`);
  
  renderInventory();
}

function getBrandNameByCode(code) {
  return state.brands.find((brand) => brand.codigo === code)?.nome;
}

// Função auxiliar para normalizar nomes de marca para comparação
function normalizeBrandName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function sortVehicles(list, criteria = 'recommended') {
  const sorted = [...list];
  switch (criteria) {
    case 'priceAsc':
      sorted.sort((a, b) => a.priceNumber - b.priceNumber);
      break;
    case 'priceDesc':
      sorted.sort((a, b) => b.priceNumber - a.priceNumber);
      break;
    case 'yearDesc':
      sorted.sort((a, b) => b.year - a.year);
      break;
    case 'mileageAsc':
      sorted.sort((a, b) => a.mileage - b.mileage);
      break;
    default:
      sorted.sort((a, b) => b.certified - a.certified || a.priceNumber - b.priceNumber);
      break;
  }
  return sorted;
}

function renderInventory() {
  if (!selectors.inventoryGrid) return;

  selectors.inventoryGrid.innerHTML = '';

  if (state.loadingInventory) {
    return;
  }

  if (!state.filteredInventory.length) {
    if (selectors.inventoryFeedback) {
      setInventoryFeedback(
        'empty',
        'Nenhum veículo encontrado.',
        'Ajuste os filtros para ver outras opções disponíveis.'
      );
    }
    if (selectors.inventoryCount) {
      selectors.inventoryCount.textContent = 'Nenhum veículo encontrado';
    }
    return;
  }

  if (selectors.inventoryFeedback) {
    clearInventoryFeedback();
  }
  if (selectors.inventoryCount) {
    selectors.inventoryCount.textContent = `${state.filteredInventory.length} ${
      state.filteredInventory.length === 1 ? 'veículo' : 'veículos'
    } encontrados`;
  }

  const fragment = document.createDocumentFragment();

  console.log(`🎨 Renderizando ${state.filteredInventory.length} veículos...`);
  
  state.filteredInventory.forEach((vehicle, index) => {
    if (!vehicle || !vehicle.model) {
      console.warn(`⚠️ Veículo ${index} inválido, pulando:`, vehicle);
      return;
    }
    
    if (index < 3) {
      console.log(`   Renderizando veículo ${index + 1}: ${vehicle.brand} ${vehicle.model} (${vehicle.source})`);
    }
    
    const card = document.createElement('article');
    card.className = 'vehicle-card';
    
    // Garante que sempre há uma URL de imagem válida
    let imageUrl = vehicle.image;
    
    // Verifica se a imagem é válida
    if (!imageUrl || 
        imageUrl === 'undefined' || 
        imageUrl === 'null' || 
        imageUrl === '' ||
        !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
      // Se não tem imagem válida, gera uma baseada no carro
      if (vehicle.brand && vehicle.model) {
        imageUrl = getCarImage(vehicle.brand, vehicle.model, vehicle.year);
      } else {
        // Usa fallback baseado em hash para consistência
        const hash = (vehicle.id || Math.random()).toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        imageUrl = fallbackImages[hash % fallbackImages.length];
      }
    }
    
    const safeModel = vehicle.model.replace(/"/g, '&quot;');
    const safePrice = vehicle.priceLabel || 'R$ 0,00';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = safeModel || 'Carro';
    img.loading = 'lazy';
    img.className = 'vehicle-card__image';
    img.style.cursor = 'pointer';
    img.style.display = 'block';
    img.style.width = '100%';
    img.style.height = '200px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = 'var(--radius-md)';
    img.style.backgroundColor = 'var(--field-bg)';
    
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      openGallery(vehicle);
    });
    
    // Fallback inteligente: tenta buscar imagens mais genéricas se a específica falhar
    let fallbackAttempts = 0;
    
    img.onerror = function() {
      fallbackAttempts++;
      console.warn(`❌ Erro ao carregar imagem (tentativa ${fallbackAttempts}):`, imageUrl.substring(0, 80));
      
      if (fallbackAttempts === 1) {
        // Primeira tentativa: usa imagem de fallback baseada em hash
        const hash = (vehicle.brand + vehicle.model + vehicle.year).toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const fallbackUrl = fallbackImages[hash % fallbackImages.length];
        console.log(`🔄 Tentando fallback 1:`, fallbackUrl.substring(0, 50));
        this.src = fallbackUrl;
        return;
      }
      
      if (fallbackAttempts === 2) {
        // Segunda tentativa: outra imagem de fallback
        const hash2 = (vehicle.id || Math.random()).toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const fallbackUrl2 = fallbackImages[(hash2 + 1) % fallbackImages.length];
        console.log(`🔄 Tentando fallback 2:`, fallbackUrl2.substring(0, 50));
        this.src = fallbackUrl2;
        return;
      }
      
      // Última tentativa: placeholder SVG
      console.log(`🔄 Usando placeholder SVG`);
      this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="900" height="600"%3E%3Crect fill="%23e5e7eb" width="900" height="600"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-family="sans-serif" font-size="24"%3ECarro%3C/text%3E%3C/svg%3E';
      this.onerror = null; // Previne loop infinito
    };
    
    // Log quando a imagem carregar com sucesso
    img.onload = function() {
      console.log(`✅ Imagem carregada com sucesso: ${vehicle.brand} ${vehicle.model}`);
    };
    
    // Adiciona a imagem como primeiro elemento do card
    card.appendChild(img);
    
    const header = document.createElement('div');
    header.className = 'vehicle-card__header';
    header.innerHTML = `
      <div>
        <h3>${safeModel}</h3>
        <p class="vehicle-card__meta">${vehicle.year || 'N/A'} • ${(vehicle.mileage || 0).toLocaleString(
          'pt-BR'
        )} km • ${vehicle.transmission || 'N/A'}</p>
      </div>
      <span class="vehicle-card__chip" title="Combustível">${vehicle.fuel || 'Flex'}</span>
    `;
    card.appendChild(header);
    
    const price = document.createElement('div');
    price.className = 'vehicle-card__price';
    price.textContent = safePrice;
    card.appendChild(price);
    
    const meta = document.createElement('div');
    meta.className = 'vehicle-card__meta';
    meta.innerHTML = `
      <span>${vehicle.source === 'user' ? 'Anúncio' : 'FIPE'} ${vehicle.codeFipe || 'N/A'}</span>
      <span>Ref. ${vehicle.reference || 'N/A'}</span>
      ${vehicle.certified ? '<span>Certificado AutoPrime</span>' : ''}
    `;
    card.appendChild(meta);
    
    const actions = document.createElement('div');
    actions.className = 'vehicle-card__actions';
    actions.innerHTML = `
      <button type="button" data-action="save" data-id="${vehicle.id}">Salvar</button>
      <button type="button" class="primary-btn" data-action="deal" data-id="${vehicle.id}">
        Quero negociar
      </button>
    `;
    card.appendChild(actions);
    
    // Adiciona evento de clique no card para abrir detalhes
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      // Não abre se clicar nos botões
      if (!e.target.closest('button')) {
        openVehicleDetails(vehicle);
      }
    });
    
    fragment.appendChild(card);
  });

  selectors.inventoryGrid.appendChild(fragment);
  wireInventoryActions();
}

function wireInventoryActions() {
  selectors.inventoryGrid
    ?.querySelectorAll('button[data-action="save"]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        const vehicle = state.inventory.find((item) => item.id === button.dataset.id);
        if (!vehicle) return;
        addVehicleToGarage(vehicle);
        showToast(`${vehicle.model} adicionado(a) à sua garagem!`, 'success');
      })
    );

  selectors.inventoryGrid
    ?.querySelectorAll('button[data-action="deal"]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        const vehicle = state.inventory.find((item) => item.id === button.dataset.id);
        if (!vehicle) return;
        button.disabled = true;
        showToast(
          `Solicitação enviada! Um especialista entrará em contato sobre o ${vehicle.model}.`,
          'info'
        );
        setTimeout(() => {
          button.disabled = false;
        }, 4000);
      })
    );
}

function addVehicleToGarage(vehicle) {
  if (!selectors.garageList) return;
  
  // Verifica se já existe no localStorage
  if (state.savedVehicles.some((v) => v.id === vehicle.id)) {
    return;
  }

  const vehicleToSave = { ...vehicle, addedAt: new Date().toISOString() };
  state.savedVehicles.push(vehicleToSave);
  localStorage.setItem('autoprime.savedVehicles', JSON.stringify(state.savedVehicles));
  
  renderGarage();
}

function renderGarage() {
  if (!selectors.garageList) return;
  
  selectors.garageList.innerHTML = '';
  
  if (state.savedVehicles.length === 0) {
    selectors.garageList.innerHTML = `
      <p style="text-align: center; color: var(--text-subtle); padding: 2rem;">
        Sua garagem está vazia. Salve veículos da vitrine para vê-los aqui!
      </p>
    `;
    return;
  }

  state.savedVehicles.forEach((vehicle) => {
    const item = document.createElement('article');
    item.className = 'garage__item';
    item.dataset.id = vehicle.id;
    const addedDate = vehicle.addedAt ? new Date(vehicle.addedAt).toLocaleDateString('pt-BR') : 'Agora mesmo';
    item.innerHTML = `
      <img src="${vehicle.image || fallbackImages[0]}" alt="${vehicle.model}" loading="lazy" onerror="this.src='${fallbackImages[0]}'" />
      <div>
        <h3>${vehicle.model}</h3>
        <p>${(vehicle.mileage || 0).toLocaleString('pt-BR')} km • ${vehicle.transmission || 'N/A'} • ${vehicle.fuel || 'Flex'}</p>
        <small>Adicionado em ${addedDate}</small>
      </div>
    `;
    selectors.garageList.appendChild(item);
  });
  
  // Limita a garagem aos 6 itens mais recentes
  const garages = selectors.garageList.querySelectorAll('.garage__item');
  if (garages.length > 6) {
    garages[garages.length - 1].remove();
  }
}

function setInventoryFeedback(stateType, title, message) {
  if (!selectors.inventoryFeedback) return;
  selectors.inventoryFeedback.hidden = false;
  selectors.inventoryFeedback.dataset.state = stateType;
  selectors.inventoryFeedback.innerHTML = `<div><strong>${title}</strong><span>${message}</span></div>`;
}

function clearInventoryFeedback() {
  if (!selectors.inventoryFeedback) return;
  selectors.inventoryFeedback.hidden = true;
  selectors.inventoryFeedback.removeAttribute('data-state');
  selectors.inventoryFeedback.innerHTML = '';
}

// Função auxiliar para delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJSON(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Adiciona delay antes de cada requisição (exceto a primeira)
      if (attempt > 0) {
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Backoff exponencial, max 5s
        console.log(`⏳ Aguardando ${backoffDelay}ms antes de tentar novamente...`);
        await delay(backoffDelay);
      }
      
      const response = await fetch(url);
      
      if (response.status === 429) {
        // Rate limit - espera mais tempo
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 3000 * (attempt + 1);
        console.warn(`⚠️ Rate limit atingido (429). Aguardando ${waitTime}ms...`);
        await delay(waitTime);
        continue; // Tenta novamente
      }
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados (${response.status})`);
      }
      
      return response.json();
    } catch (error) {
      if (attempt === retries - 1) {
        // Última tentativa falhou
        console.error(`❌ Erro ao buscar ${url} após ${retries} tentativas:`, error);
        throw error;
      }
      console.warn(`⚠️ Tentativa ${attempt + 1}/${retries} falhou para ${url}:`, error.message);
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  throw new Error(`Falha ao buscar ${url} após ${retries} tentativas`);
}

// Galeria de Fotos
let currentGalleryImages = [];
let currentGalleryIndex = 0;
let currentGalleryVehicle = null;

function openGallery(vehicle) {
  if (!selectors.galleryModal) return;
  
  currentGalleryVehicle = vehicle;
  
  // Coleta todas as imagens disponíveis do veículo
  currentGalleryImages = [];
  
  // Adiciona a imagem principal
  if (vehicle.image) {
    currentGalleryImages.push(vehicle.image);
  }
  
  // Se o veículo tiver múltiplas imagens (futuro), adiciona aqui
  if (vehicle.images && Array.isArray(vehicle.images)) {
    currentGalleryImages.push(...vehicle.images);
  }
  
  // Se não tiver imagens, adiciona fallbacks
  if (currentGalleryImages.length === 0) {
    currentGalleryImages = fallbackImages;
  }
  
  // Gera miniaturas adicionais baseadas no modelo
  if (currentGalleryImages.length < 5) {
    for (let i = 0; i < 4; i++) {
      const additionalImage = getCarImage(vehicle.brand, vehicle.model, vehicle.year + i);
      if (!currentGalleryImages.includes(additionalImage)) {
        currentGalleryImages.push(additionalImage);
      }
    }
  }
  
  currentGalleryIndex = 0;
  updateGalleryDisplay();
  selectors.galleryModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeGallery() {
  if (!selectors.galleryModal) return;
  selectors.galleryModal.hidden = true;
  document.body.style.overflow = '';
  currentGalleryImages = [];
  currentGalleryIndex = 0;
  currentGalleryVehicle = null;
}

function updateGalleryDisplay() {
  if (!selectors.galleryMainImage || currentGalleryImages.length === 0) return;
  
  const currentImage = currentGalleryImages[currentGalleryIndex];
  selectors.galleryMainImage.src = currentImage;
  
  if (selectors.galleryVehicleName && currentGalleryVehicle) {
    selectors.galleryVehicleName.textContent = currentGalleryVehicle.model || 'Veículo';
  }
  
  if (selectors.galleryImageCounter) {
    selectors.galleryImageCounter.textContent = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;
  }
  
  // Atualiza miniaturas
  if (selectors.galleryThumbs) {
    selectors.galleryThumbs.innerHTML = '';
    currentGalleryImages.forEach((imgSrc, index) => {
      const thumb = document.createElement('img');
      thumb.src = imgSrc;
      thumb.alt = `Miniatura ${index + 1}`;
      thumb.className = index === currentGalleryIndex ? 'gallery-thumb gallery-thumb--active' : 'gallery-thumb';
      thumb.addEventListener('click', () => {
        currentGalleryIndex = index;
        updateGalleryDisplay();
      });
      selectors.galleryThumbs.appendChild(thumb);
    });
  }
  
  // Atualiza botões de navegação
  if (selectors.galleryPrev) {
    selectors.galleryPrev.disabled = currentGalleryIndex === 0;
  }
  if (selectors.galleryNext) {
    selectors.galleryNext.disabled = currentGalleryIndex === currentGalleryImages.length - 1;
  }
}

function galleryNext() {
  if (currentGalleryIndex < currentGalleryImages.length - 1) {
    currentGalleryIndex++;
    updateGalleryDisplay();
  }
}

function galleryPrev() {
  if (currentGalleryIndex > 0) {
    currentGalleryIndex--;
    updateGalleryDisplay();
  }
}

// Event listeners da galeria
if (selectors.galleryClose) {
  selectors.galleryClose.addEventListener('click', closeGallery);
}
if (selectors.galleryNext) {
  selectors.galleryNext.addEventListener('click', galleryNext);
}
if (selectors.galleryPrev) {
  selectors.galleryPrev.addEventListener('click', galleryPrev);
}
if (selectors.galleryModal) {
  const overlay = selectors.galleryModal.querySelector('.gallery-modal__overlay');
  if (overlay) {
    overlay.addEventListener('click', closeGallery);
  }
}

// Fechar galeria com ESC e navegar com setas
document.addEventListener('keydown', (e) => {
  if (!selectors.galleryModal || selectors.galleryModal.hidden) return;
  
  if (e.key === 'Escape') {
    closeGallery();
  }
  if (e.key === 'ArrowLeft') {
    galleryPrev();
  }
  if (e.key === 'ArrowRight') {
    galleryNext();
  }
});

function showToast(message, variant = 'default') {
  if (!selectors.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (variant === 'error') {
    toast.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    toast.style.background = 'rgba(239, 68, 68, 0.1)';
  }

  const icon = getToastIcon(variant);
  toast.innerHTML = `
    ${icon}
    <span>${message}</span>
    <button type="button" class="toast__close" aria-label="Fechar aviso">&times;</button>
  `;

  selectors.toastContainer.appendChild(toast);

  const closeButton = toast.querySelector('.toast__close');
  closeButton.addEventListener('click', () => {
    toast.remove();
  });

  setTimeout(() => {
    toast.remove();
  }, 4500);
}

function getToastIcon(variant) {
  const baseIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1010 10A10.011 10.011 0 0012 2zm1 15h-2v-2h2zm0-4h-2V7h2z"></path></svg>';

  if (variant === 'success') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1010 10A10.011 10.011 0 0012 2zm-1.2 14.3l-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4z"></path></svg>';
  }

  if (variant === 'info') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1010 10A10.011 10.011 0 0012 2zm1 14h-2v-4h2zm0-6h-2V8h2z"></path></svg>';
  }

  if (variant === 'error') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1010 10A10.011 10.011 0 0012 2zm1 11h-2v-2h2zm0-4h-2V5h2z"></path></svg>';
  }

  return baseIcon;
}

function parseCurrency(value) {
  if (typeof value !== 'string') return Number(value) || 0;
  const normalized = value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return Number(normalized);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function debounce(fn, delay = 200) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}


