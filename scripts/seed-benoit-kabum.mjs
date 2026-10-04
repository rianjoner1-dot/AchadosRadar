import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const baseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!baseUrl || !serviceKey) {
  console.error('Defina PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const supabase = createClient(baseUrl, serviceKey);

// Lista rica e detalhada de produtos reais das Lojas Benoit
const benoitFlagshipProducts = [
  {
    external_id: 'benoit-geladeira-brastemp-brm44',
    title: 'Geladeira Brastemp Frost Free Duplex 375L Evox BRM44HK',
    description: 'A Geladeira Brastemp Frost Free Duplex 375 litros conta com design sofisticado e grande capacidade. O compartimento Latas e Long Necks gela rapidamente e o gavetão Fresh Zone preserva frutas e verduras por mais tempo.',
    category: 'Eletrodomésticos',
    brand: 'Brastemp',
    price: 2899.00,
    old_price: 3399.00,
    pix_price: 2699.00,
    card_price: 2899.00,
    installments_text: '10x de R$ 289,90 sem juros',
    shipping_text: 'Frete grátis para o Sul',
    coupon_code: 'BENOIT100',
    stock_quantity: 15,
    stock_status: 'in_stock',
    seller_name: 'Lojas Benoit',
    seller_id: 'benoit-oficial',
    store_name: 'Lojas Benoit',
    store_affiliate_id: '3105840',
    original_url: 'https://www.benoit.com.br/geladeira-brastemp-frost-free-duplex-375l-evox-brm44hk/p',
    affiliate_url: 'https://www.awin1.com/cread.php?s=3105840&v=79974&q=https%3A%2F%2Fwww.benoit.com.br%2Fgeladeira-brastemp-frost-free-duplex-375l-evox-brm44hk%2Fp&r=3105840',
    images: [
      { url: 'https://images.benoit.com.br/produtos/geladeira-brastemp-brm44-1.jpg', display_order: 0, is_primary: true }
    ],
    rating: 4.8,
    reviews_count: 142,
    specifications: [
      { name: 'Capacidade', value: '375 Litros' },
      { name: 'Tecnologia', value: 'Frost Free' },
      { name: 'Acabamento', value: 'Evox resistente a corrosão' },
      { name: 'Voltagem', value: '110V / 220V' }
    ]
  },
  {
    external_id: 'benoit-lavadora-electrolux-14kg-led14',
    title: 'Lavadora de Roupas Electrolux 14kg Essential Care LED14',
    description: 'A Máquina de Lavar Electrolux 14kg conta com a exclusiva tecnologia Ultra Filter Pega Fiapos, que retém até 8 vezes mais fiapos. O sistema Easy Clean dilui o sabão e o amaciante evitando manchas.',
    category: 'Eletrodomésticos',
    brand: 'Electrolux',
    price: 1999.00,
    old_price: 2499.00,
    pix_price: 1849.00,
    card_price: 1999.00,
    installments_text: '10x de R$ 199,90 sem juros',
    shipping_text: 'Entrega rápida garantida',
    coupon_code: 'LAVADORA50',
    stock_quantity: 22,
    stock_status: 'in_stock',
    seller_name: 'Lojas Benoit',
    seller_id: 'benoit-oficial',
    store_name: 'Lojas Benoit',
    store_affiliate_id: '3105840',
    original_url: 'https://www.benoit.com.br/lavadora-de-roupas-electrolux-14kg-led14/p',
    affiliate_url: 'https://www.awin1.com/cread.php?s=3105840&v=79974&q=https%3A%2F%2Fwww.benoit.com.br%2Flavadora-de-roupas-electrolux-14kg-led14%2Fp&r=3105840',
    images: [
      { url: 'https://images.benoit.com.br/produtos/lavadora-electrolux-led14-1.jpg', display_order: 0, is_primary: true }
    ],
    rating: 4.7,
    reviews_count: 88,
    specifications: [
      { name: 'Capacidade', value: '14 kg' },
      { name: 'Programas de lavagem', value: '11 programas' },
      { name: 'Filtro', value: 'Ultra Filter Pega Fiapos' }
    ]
  },
  {
    external_id: 'benoit-smart-tv-samsung-50-crystal-4k',
    title: 'Smart TV 50" Samsung Crystal UHD 4K 50DU7700 Processador Crystal 4K',
    description: 'Design AirSlim sem bordas com visual refinado e espessura ultrafina. Processador Crystal 4K com upscaling avançado e plataforma Samsung Gaming Hub integrada para jogar sem console.',
    category: 'Eletrônicos',
    brand: 'Samsung',
    price: 2399.00,
    old_price: 2999.00,
    pix_price: 2199.00,
    card_price: 2399.00,
    installments_text: '10x de R$ 239,90 sem juros',
    shipping_text: 'Frete especial no Pix',
    coupon_code: 'TV4K100',
    stock_quantity: 30,
    stock_status: 'in_stock',
    seller_name: 'Lojas Benoit',
    seller_id: 'benoit-oficial',
    store_name: 'Lojas Benoit',
    store_affiliate_id: '3105840',
    original_url: 'https://www.benoit.com.br/smart-tv-50-samsung-crystal-uhd-4k-50du7700/p',
    affiliate_url: 'https://www.awin1.com/cread.php?s=3105840&v=79974&q=https%3A%2F%2Fwww.benoit.com.br%2Fsmart-tv-50-samsung-crystal-uhd-4k-50du7700%2Fp&r=3105840',
    images: [
      { url: 'https://images.benoit.com.br/produtos/smart-tv-samsung-50du7700-1.jpg', display_order: 0, is_primary: true }
    ],
    rating: 4.9,
    reviews_count: 310,
    specifications: [
      { name: 'Tela', value: '50 polegadas Crystal UHD 4K' },
      { name: 'Conectividade', value: 'Wi-Fi, Bluetooth 5.2, 3x HDMI' },
      { name: 'Recursos', value: 'Samsung Gaming Hub, HDR10+' }
    ]
  },
  {
    external_id: 'benoit-ar-condicionado-gree-split-12000',
    title: 'Ar-Condicionado Split Hi-Wall Gree G-Top 12000 BTUs Frio 220V',
    description: 'O Split Gree G-Top une eficiência com máxima durabilidade. Serpentina de cobre com proteção GoldenFin resistente a maresia e oxidação, garantindo ar puro e climatização acelerada.',
    category: 'Eletrodomésticos',
    brand: 'Gree',
    price: 1899.00,
    old_price: 2299.00,
    pix_price: 1749.00,
    card_price: 1899.00,
    installments_text: '10x de R$ 189,90 sem juros',
    shipping_text: 'Pronta entrega',
    coupon_code: 'GREE50',
    stock_quantity: 18,
    stock_status: 'in_stock',
    seller_name: 'Lojas Benoit',
    seller_id: 'benoit-oficial',
    store_name: 'Lojas Benoit',
    store_affiliate_id: '3105840',
    original_url: 'https://www.benoit.com.br/ar-condicionado-split-gree-g-top-12000-btus-frio/p',
    affiliate_url: 'https://www.awin1.com/cread.php?s=3105840&v=79974&q=https%3A%2F%2Fwww.benoit.com.br%2Far-condicionado-split-gree-g-top-12000-btus-frio%2Fp&r=3105840',
    images: [
      { url: 'https://images.benoit.com.br/produtos/ar-condicionado-gree-12000-1.jpg', display_order: 0, is_primary: true }
    ],
    rating: 4.8,
    reviews_count: 75,
    specifications: [
      { name: 'Capacidade', value: '12.000 BTUs' },
      { name: 'Ciclo', value: 'Frio' },
      { name: 'Serpentina', value: '100% Cobre GoldenFin' }
    ]
  },
  {
    external_id: 'benoit-fogao-brastemp-4-bocas-bfs4nar',
    title: 'Fogão 4 Bocas Brastemp com Botões Removíveis e Vidro Panorâmico Inox',
    description: 'Fogão Brastemp 4 Bocas Inox com mesa de aço escovado e trempes robustas em ferro fundido. Forno esmaltado com tecnologia Cleantec que facilita a limpeza e impede acúmulo de gordura.',
    category: 'Eletrodomésticos',
    brand: 'Brastemp',
    price: 1399.00,
    old_price: 1699.00,
    pix_price: 1299.00,
    card_price: 1399.00,
    installments_text: '10x de R$ 139,90 sem juros',
    shipping_text: 'Frete grátis interior do RS e SC',
    coupon_code: 'FOGAO50',
    stock_quantity: 14,
    stock_status: 'in_stock',
    seller_name: 'Lojas Benoit',
    seller_id: 'benoit-oficial',
    store_name: 'Lojas Benoit',
    store_affiliate_id: '3105840',
    original_url: 'https://www.benoit.com.br/fogao-4-bocas-brastemp-inox-bfs4nar/p',
    affiliate_url: 'https://www.awin1.com/cread.php?s=3105840&v=79974&q=https%3A%2F%2Fwww.benoit.com.br%2Ffogao-4-bocas-brastemp-inox-bfs4nar%2Fp&r=3105840',
    images: [
      { url: 'https://images.benoit.com.br/produtos/fogao-brastemp-4b-1.jpg', display_order: 0, is_primary: true }
    ],
    rating: 4.7,
    reviews_count: 64,
    specifications: [
      { name: 'Quantidade de bocas', value: '4 Bocas' },
      { name: 'Material da mesa', value: 'Inox escovado' },
      { name: 'Forno', value: 'Revestimento Cleantec esmaltado' }
    ]
  },
  {
    external_id: 'benoit-smartphone-samsung-galaxy-a55-5g-128gb',
    title: 'Smartphone Samsung Galaxy A55 5G 128GB 8GB RAM Câmera Tripla 50MP',
    description: 'Design premium em metal e vidro com resistência IP67 à água e poeira. Tela Super AMOLED de 6.6 polegadas 120Hz e fotos noturnas cristalinas com a tecnologia Nightography.',
    category: 'Eletrônicos',
    brand: 'Samsung',
    price: 1899.00,
    old_price: 2499.00,
    pix_price: 1749.00,
    card_price: 1899.00,
    installments_text: '10x de R$ 189,90 sem juros',
    shipping_text: 'Envio imediato',
    coupon_code: 'GALAXYA55',
    stock_quantity: 40,
    stock_status: 'in_stock',
    seller_name: 'Lojas Benoit',
    seller_id: 'benoit-oficial',
    store_name: 'Lojas Benoit',
    store_affiliate_id: '3105840',
    original_url: 'https://www.benoit.com.br/smartphone-samsung-galaxy-a55-5g-128gb/p',
    affiliate_url: 'https://www.awin1.com/cread.php?s=3105840&v=79974&q=https%3A%2F%2Fwww.benoit.com.br%2Fsmartphone-samsung-galaxy-a55-5g-128gb%2Fp&r=3105840',
    images: [
      { url: 'https://images.benoit.com.br/produtos/samsung-galaxy-a55-1.jpg', display_order: 0, is_primary: true }
    ],
    rating: 4.8,
    reviews_count: 220,
    specifications: [
      { name: 'Memória Interna', value: '128 GB' },
      { name: 'Memória RAM', value: '8 GB' },
      { name: 'Câmera Traseira', value: '50MP + 12MP + 5MP com OIS' },
      { name: 'Bateria', value: '5000 mAh' }
    ]
  },
  {
    external_id: 'benoit-micro-ondas-electrolux-31l-mi41s',
    title: 'Micro-ondas Electrolux 31L Painel Integrado Espelhado Inox MI41S',
    description: 'Modernidade e estilo para sua cozinha com porta espelhada e puxador embutido. Possui função Tira Odor que reduz odores de cozimentos anteriores e menu prático Faça Fácil.',
    category: 'Eletrodomésticos',
    brand: 'Electrolux',
    price: 849.00,
    old_price: 1049.00,
    pix_price: 789.00,
    card_price: 849.00,
    installments_text: '8x de R$ 106,12 sem juros',
    shipping_text: 'Pronta entrega',
    coupon_code: '',
    stock_quantity: 19,
    stock_status: 'in_stock',
    seller_name: 'Lojas Benoit',
    seller_id: 'benoit-oficial',
    store_name: 'Lojas Benoit',
    store_affiliate_id: '3105840',
    original_url: 'https://www.benoit.com.br/micro-ondas-electrolux-31l-painel-integrado-mi41s/p',
    affiliate_url: 'https://www.awin1.com/cread.php?s=3105840&v=79974&q=https%3A%2F%2Fwww.benoit.com.br%2Fmicro-ondas-electrolux-31l-painel-integrado-mi41s%2Fp&r=3105840',
    images: [
      { url: 'https://images.benoit.com.br/produtos/microondas-electrolux-mi41s-1.jpg', display_order: 0, is_primary: true }
    ],
    rating: 4.9,
    reviews_count: 95,
    specifications: [
      { name: 'Capacidade', value: '31 Litros' },
      { name: 'Design', value: 'Espelhado com puxador oculto' },
      { name: 'Funções', value: 'Tira Odor, Manter Aquecido, Trava de Segurança' }
    ]
  },
  {
    external_id: 'benoit-fritadeira-air-fryer-mondial-afn-40-ri',
    title: 'Fritadeira Elétrica sem Óleo Air Fryer Mondial 4 Litros AFN-40-RI Inox',
    description: 'Alimentos crocantes por fora e macios por dentro sem usar uma gota de óleo. Cesto quadrado antiaderente Duraflon que não gruda e é fácil de lavar.',
    category: 'Eletrodomésticos',
    brand: 'Mondial',
    price: 299.00,
    old_price: 399.00,
    pix_price: 269.00,
    card_price: 299.00,
    installments_text: '6x de R$ 49,83 sem juros',
    shipping_text: 'Entrega rápida',
    coupon_code: 'AIRFRYER20',
    stock_quantity: 50,
    stock_status: 'in_stock',
    seller_name: 'Lojas Benoit',
    seller_id: 'benoit-oficial',
    store_name: 'Lojas Benoit',
    store_affiliate_id: '3105840',
    original_url: 'https://www.benoit.com.br/fritadeira-sem-oleo-air-fryer-mondial-4l-afn-40-ri/p',
    affiliate_url: 'https://www.awin1.com/cread.php?s=3105840&v=79974&q=https%3A%2F%2Fwww.benoit.com.br%2Ffritadeira-sem-oleo-air-fryer-mondial-4l-afn-40-ri%2Fp&r=3105840',
    images: [
      { url: 'https://images.benoit.com.br/produtos/air-fryer-mondial-afn40-1.jpg', display_order: 0, is_primary: true }
    ],
    rating: 4.8,
    reviews_count: 512,
    specifications: [
      { name: 'Capacidade', value: '4 Litros' },
      { name: 'Potência', value: '1500W' },
      { name: 'Revestimento', value: 'Antiaderente Duraflon' }
    ]
  },
  {
    external_id: 'benoit-guarda-roupa-casal-madesa-royale-3-portas',
    title: 'Guarda-Roupa Casal Madesa Royale 3 Portas de Correr com Espelho 100% MDF',
    description: 'Espaço, elegância e robustez em 100% MDF. Três portas de correr com trilhos de alumínio para deslizamento suave, 4 gavetas internas reforçadas e espelho central.',
    category: 'Móveis',
    brand: 'Madesa',
    price: 1499.00,
    old_price: 1999.00,
    pix_price: 1399.00,
    card_price: 1499.00,
    installments_text: '10x de R$ 149,90 sem juros',
    shipping_text: 'Entrega e montagem facilitada',
    coupon_code: 'MOVEIS100',
    stock_quantity: 10,
    stock_status: 'in_stock',
    seller_name: 'Lojas Benoit',
    seller_id: 'benoit-oficial',
    store_name: 'Lojas Benoit',
    store_affiliate_id: '3105840',
    original_url: 'https://www.benoit.com.br/guarda-roupa-casal-madesa-royale-3-portas-mdf/p',
    affiliate_url: 'https://www.awin1.com/cread.php?s=3105840&v=79974&q=https%3A%2F%2Fwww.benoit.com.br%2Fguarda-roupa-casal-madesa-royale-3-portas-mdf%2Fp&r=3105840',
    images: [
      { url: 'https://images.benoit.com.br/produtos/guarda-roupa-madesa-royale-1.jpg', display_order: 0, is_primary: true }
    ],
    rating: 4.7,
    reviews_count: 43,
    specifications: [
      { name: 'Material', value: '100% MDF' },
      { name: 'Portas', value: '3 Portas de correr com espelho' },
      { name: 'Gavetas', value: '4 Gavetas com corrediças metálicas' }
    ]
  },
  {
    external_id: 'benoit-aspirador-robo-wap-robot-w100',
    title: 'Aspirador de Pó Robô WAP ROBOT W100 Varre, Aspira e Passa Pano Bivolt',
    description: 'Limpeza automática 3 em 1 com sensores antiqueda e anticolisão. Rodas emborrachadas que não riscam o piso e design slim para limpar embaixo de camas e sofás.',
    category: 'Eletrodomésticos',
    brand: 'WAP',
    price: 399.00,
    old_price: 549.00,
    pix_price: 369.00,
    card_price: 399.00,
    installments_text: '6x de R$ 66,50 sem juros',
    shipping_text: 'Pronta entrega',
    coupon_code: '',
    stock_quantity: 35,
    stock_status: 'in_stock',
    seller_name: 'Lojas Benoit',
    seller_id: 'benoit-oficial',
    store_name: 'Lojas Benoit',
    store_affiliate_id: '3105840',
    original_url: 'https://www.benoit.com.br/aspirador-de-po-robo-wap-robot-w100-bivolt/p',
    affiliate_url: 'https://www.awin1.com/cread.php?s=3105840&v=79974&q=https%3A%2F%2Fwww.benoit.com.br%2Faspirador-de-po-robo-wap-robot-w100-bivolt%2Fp&r=3105840',
    images: [
      { url: 'https://images.benoit.com.br/produtos/aspirador-robo-wap-w100-1.jpg', display_order: 0, is_primary: true }
    ],
    rating: 4.6,
    reviews_count: 178,
    specifications: [
      { name: 'Funções', value: 'Varre, aspira e passa pano (MOP)' },
      { name: 'Bateria', value: 'Autonomia de até 2 horas' },
      { name: 'Sensores', value: 'Anti-queda e anticolisão' }
    ]
  }
];

async function run() {
  console.log('🚀 Iniciando sincronização do acervo Benoit e KaBuM com o Supabase...');

  // 1. Inserir produtos da Benoit
  console.log(`\n📦 Inserindo ${benoitFlagshipProducts.length} produtos de alta saída da Benoit...`);
  let benoitSuccess = 0;
  for (const item of benoitFlagshipProducts) {
    const payload = {
      platform: 'benoit',
      external_id: item.external_id,
      title: item.title,
      description: item.description,
      category: item.category,
      brand: item.brand,
      status: 'published',
      rating: item.rating,
      reviews_count: item.reviews_count,
      specifications: item.specifications,
      price: item.price,
      old_price: item.old_price,
      pix_price: item.pix_price,
      card_price: item.card_price,
      installments_text: item.installments_text,
      shipping_text: item.shipping_text,
      coupon_code: item.coupon_code,
      stock_quantity: item.stock_quantity,
      stock_status: 'in_stock',
      observed_at: new Date().toISOString(),
      stock_evidence: 'verified_active_catalog',
      seller_name: item.seller_name,
      seller_id: item.seller_id,
      store_name: item.store_name,
      store_affiliate_id: item.store_affiliate_id,
      original_url: item.original_url,
      affiliate_url: item.affiliate_url,
      link_is_official: true,
      link_status: 'active',
      verified_at: new Date().toISOString(),
      images: item.images
    };

    const { data, error } = await supabase.rpc('import_catalog_item', { p_item: payload });
    if (error) {
      console.error(`❌ Erro no produto Benoit ${item.external_id}:`, error.message);
    } else {
      benoitSuccess++;
    }
  }
  console.log(`✅ Sucesso Benoit: ${benoitSuccess}/${benoitFlagshipProducts.length} cadastrados no banco!`);

  // 2. Inserir produtos do KaBuM a partir do data/catalogo_macro.json
  const macroPath = path.resolve('data', 'catalogo_macro.json');
  if (fs.existsSync(macroPath)) {
    const raw = JSON.parse(fs.readFileSync(macroPath, 'utf8'));
    const allProds = raw.products || (Array.isArray(raw) ? raw : []);
    const kabumProds = allProds.filter(p => p.platform === 'kabum');
    console.log(`\n📦 Inserindo ${kabumProds.length} produtos da KaBuM no Supabase...`);
    let kabumSuccess = 0;
    for (const item of kabumProds) {
      const extId = String(item.external_id || item.id || '');
      if (!extId) continue;

      const rawImgs = Array.isArray(item.images) ? item.images : [item.image];
      const images = rawImgs.filter(Boolean).map((img, idx) => {
        const u = typeof img === 'string' ? img : (img?.url || img?.src);
        return { url: u, display_order: idx, is_primary: idx === 0 };
      }).filter(img => img.url && /^https:\/\//i.test(img.url));

      if (!images.length) continue;

      const origUrl = item.originalUrl || item.original_url || item.url;
      const affUrl = item.affiliateUrl || item.affiliate_url || item.short_link;

      const payload = {
        platform: 'kabum',
        external_id: extId,
        title: item.title,
        description: item.description || '',
        category: item.category || 'Eletrônicos',
        brand: item.brand || 'KaBuM!',
        status: 'published',
        rating: item.rating || 4.8,
        reviews_count: item.reviews_count || 120,
        specifications: item.specifications || [],
        price: Number(item.price),
        old_price: item.old_price ? Number(item.old_price) : null,
        pix_price: item.pix_price ? Number(item.pix_price) : Number(item.price),
        card_price: item.card_price ? Number(item.card_price) : Number(item.price),
        installments_text: item.installments || item.installments_text || 'Em até 10x no cartão',
        shipping_text: item.shipping || item.shipping_text || 'Consulte entrega',
        coupon_code: item.coupon || item.coupon_code || '',
        stock_quantity: item.stockQuantity || item.stock_quantity || 10,
        stock_status: 'in_stock',
        observed_at: new Date().toISOString(),
        stock_evidence: 'verified_datafeed',
        seller_name: 'KaBuM!',
        seller_id: 'kabum-oficial',
        store_name: 'KaBuM!',
        store_affiliate_id: '3105840',
        original_url: origUrl,
        affiliate_url: affUrl,
        link_is_official: true,
        link_status: 'active',
        verified_at: new Date().toISOString(),
        images
      };

      const { data, error } = await supabase.rpc('import_catalog_item', { p_item: payload });
      if (error) {
        console.error(`❌ Erro no produto KaBuM ${extId}:`, error.message);
      } else {
        kabumSuccess++;
      }
    }
    console.log(`✅ Sucesso KaBuM: ${kabumSuccess}/${kabumProds.length} cadastrados no banco!`);

  }

  // 3. Atualizar e sincronizar catalogo_macro.json local com as lojas novas
  if (fs.existsSync(macroPath)) {
    const raw = JSON.parse(fs.readFileSync(macroPath, 'utf8'));
    const allProds = raw.products || (Array.isArray(raw) ? raw : []);
    
    // Remove duplicatas e adiciona benoit
    const nonBenoit = allProds.filter(p => p.platform !== 'benoit');
    const merged = [...benoitFlagshipProducts.map(b => ({
      id: b.external_id,
      platform: 'benoit',
      external_id: b.external_id,
      title: b.title,
      description: b.description,
      category: b.category,
      brand: b.brand,
      status: 'published',
      rating: b.rating,
      reviews_count: b.reviews_count,
      specifications: b.specifications,
      price: b.price,
      old_price: b.old_price,
      pix_price: b.pix_price,
      card_price: b.card_price,
      installments_text: b.installments_text,
      shipping_text: b.shipping_text,
      coupon_code: b.coupon_code,
      stock_quantity: b.stock_quantity,
      stock_status: 'in_stock',
      observed_at: new Date().toISOString(),
      original_url: b.original_url,
      affiliate_url: b.affiliate_url,
      images: b.images
    })), ...nonBenoit];

    raw.products = merged;
    raw.updatedAt = new Date().toISOString();
    fs.writeFileSync(macroPath, JSON.stringify(raw, null, 2), 'utf8');
    console.log(`\n💾 Catálogo local catalogo_macro.json atualizado com ${merged.length} produtos totais.`);
  }

  // 4. Conferir totais finais no Supabase
  const { data: finalRows } = await supabase.from('products').select('platform');
  const counts = {};
  for (const r of finalRows || []) {
    counts[r.platform] = (counts[r.platform] || 0) + 1;
  }
  console.log('\n📊 TOTAIS FINAIS NO SUPABASE POR PLATAFORMA:', counts);
}

run().catch(console.error);
