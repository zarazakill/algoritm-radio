// Конфигурационные константы
const API_BASE_URLS = {
  secure: "https://wwcat.duckdns.org:8443",
  unsecure: "https://wwcat.duckdns.org:8000"
};

const STREAM_PATHS = {
  main: "/listen/algoritm-stream/radio",
  fallback: "/radio"
};

const API_PATHS = {
  nowPlaying: "/api/nowplaying/1",
  requests: "/api/station/1/requests",
  requestSong: "/api/station/1/request/:id"
};

// Основная конфигурация
const RadioPlayerConfig = {
  // Настройки потоков с приоритетами
  streams: [
    {
      url: `${API_BASE_URLS.secure}${STREAM_PATHS.main}`,
      priority: 1,
      type: 'primary'
    },
    {
      url: `${API_BASE_URLS.unsecure}${STREAM_PATHS.fallback}`,
      priority: 2,
      type: 'fallback'
    }
  ],
  
  // Настройки API
  api: {
    endpoints: {
      nowPlaying: [
        `${API_BASE_URLS.secure}${API_PATHS.nowPlaying}`,
        `${API_BASE_URLS.unsecure}${API_PATHS.nowPlaying}`
      ],
      requests: `${API_BASE_URLS.secure}${API_PATHS.requests}`,
      requestSong: `${API_BASE_URLS.secure}${API_PATHS.requestSong}`
    },
    retryPolicy: {
      maxRetries: 3,
      retryDelay: 2000,
      timeout: 5000
    }
  },
  
  // Настройки AzuraCast
  azuraCast: {
    baseUrl: API_BASE_URLS.secure,
    artworkBaseUrl: API_BASE_URLS.secure,
    enableSongRequests: true,
    artworkSizes: {
      small: 150,
      medium: 300,
      large: 500
    }
  },
  
  // Настройки производительности
  performance: {
    updateIntervals: {
      trackInfo: 10000,
      networkCheck: 10000
    },
    buffer: {
      targetLength: 60, // секунд
      minThreshold: 15 // секунд
    },
    reconnect: {
      delay: 3000,
      maxAttempts: 5
    }
  },
  
  // Настройки UI
  ui: {
    history: {
      maxVisibleItems: 5,
      maxCachedItems: 20,
      animation: {
        delay: 100,
        duration: 300
      }
    },
    artwork: {
      defaultUrl: "img/album-art/default.jpg",
      preferredSize: 'large',
      useProxy: false,
      proxyUrl: "",
      cachePolicy: {
        enabled: true,
        ttl: 3600000 // 1 час
      }
    },
    theme: {
      default: 'dark',
      colors: {
        dark: {
          primary: '#16213e',
          background: '#1a1a2e'
        },
        light: {
          primary: '#7fc7ff',
          background: '#0082e6'
        }
      }
    }
  },
  
  // Настройки диагностики и мониторинга
  diagnostics: {
    enabled: true,
    logging: {
      interval: 60000,
      level: 'debug' // 'error', 'warn', 'info', 'debug'
    },
    analytics: {
      enabled: false,
      endpoint: ""
    }
  }
};

// Валидация конфигурации при разработке
if (process.env.NODE_ENV === 'development') {
  validateConfig(RadioPlayerConfig);
}

function validateConfig(config) {
  // Проверка обязательных полей
  const requiredFields = [
    'streams', 'api.endpoints.nowPlaying', 
    'ui.artwork.defaultUrl', 'performance.updateIntervals.trackInfo'
  ];
  
  requiredFields.forEach(path => {
    if (!getNestedValue(config, path)) {
      console.warn(`Missing required config field: ${path}`);
    }
  });

  // Проверка URL
  config.streams.forEach(stream => {
    try {
      new URL(stream.url);
    } catch (e) {
      console.warn(`Invalid stream URL: ${stream.url}`);
    }
  });
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, p) => o?.[p], obj);
}

export default RadioPlayerConfig;
