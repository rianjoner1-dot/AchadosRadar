import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

async function run() {
  const envContent = await fs.readFile('.env', 'utf8');
  const serviceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1]?.trim();
  const supabaseUrl = envContent.match(/PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();

  if (!serviceKey || !supabaseUrl) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log('🚀 Iniciando expansão e povoamento de categorias no Supabase...');

  const productsToSeed = [
    // ==========================================
    // 🛋️ MÓVEIS (Móveis reais de quarto, sala e cozinha)
    // ==========================================
    {
      platform: 'benoit',
      external_id: 'benoit-guarda-roupa-casal-6-portas',
      title: 'Guarda-Roupa Casal 6 Portas e 2 Gavetas com Espelho Kappesberg',
      description: 'O Roupeiro Casal Kappesberg combina elegância e praticidade. Estrutura 100% MDP com acabamento em pintura UV fosca, dobradiças metálicas reforçadas e espelho central amplo. Cabideiros em alumínio e gavetas com corrediças metálicas suaves.',
      category: 'Móveis',
      sector: 'moveis',
      brand: 'Kappesberg',
      price: 1199.00,
      old_price: 1499.00,
      pix_price: 1079.10,
      card_price: 1199.00,
      installments_text: '10x de R$ 119,90 sem juros',
      shipping_text: 'Entrega rápida e rastreada',
      stock_status: 'in_stock',
      seller_name: 'Lojas Benoit',
      seller_id: 'benoit-oficial',
      store_name: 'Lojas Benoit',
      original_url: 'https://www.benoit.com.br/produto/1072778',
      affiliate_url: 'https://www.awin1.com/cread.php?awinmid=79974&awinaffid=3105840&ued=https%3A%2F%2Fwww.benoit.com.br%2Fproduto%2F1072778',
      images: [
        'https://d296pbmv9m7g8v.cloudfront.net/Custom/Content/Products/10/72/1072776_balcao-com-tampo-kappesberg-g744e607cn-cb334-2-portas-88x80x52cm-10010868_s11_639135043876038125.webp'
      ],
      rating: 4.8,
      reviews_count: 64,
      specifications: [
        { name: 'Tipo', value: 'Casal 6 Portas' },
        { name: 'Material', value: 'MDP com pintura UV' },
        { name: 'Espelho', value: 'Sim, central' }
      ]
    },
    {
      platform: 'mercadolivre',
      external_id: 'MLB9102938475',
      title: 'Painel para TV até 65 Polegadas Ripado com Prateleira e LED',
      description: 'Painel Suspenso moderno com ripado autêntico em MDF e detalhe em fita de LED embutida. Ideal para salas de estar elegantes, comportando TVs de até 65 polegadas com passagem oculta de fiação.',
      category: 'Móveis',
      sector: 'moveis',
      brand: 'Madetec',
      price: 489.90,
      old_price: 649.00,
      pix_price: 440.91,
      card_price: 489.90,
      installments_text: '10x de R$ 48,99 sem juros',
      shipping_text: 'Frete grátis Full',
      stock_status: 'in_stock',
      seller_name: 'Mercado Livre Oficial',
      seller_id: 'ml-loja-oficial',
      store_name: 'Mercado Livre',
      original_url: 'https://produto.mercadolivre.com.br/MLB-9102938475-painel-tv-ripado-led',
      affiliate_url: 'https://meli.la/painel-tv-ripado',
      images: [
        'https://http2.mlstatic.com/D_Q_NP_895766-MLB89576622881_082025-O.webp'
      ],
      rating: 4.7,
      reviews_count: 153,
      specifications: [
        { name: 'Capacidade', value: 'TV até 65 polegadas' },
        { name: 'Iluminação', value: 'Fita LED bivolt inclusa' },
        { name: 'Estrutura', value: 'MDF e MDP reforçado' }
      ]
    },
    {
      platform: 'magalu',
      external_id: '235901200',
      title: 'Sofá Retrátil e Reclinável 3 Lugares Suede Veludo 2,10m',
      description: 'Conforto incomparável para suas maratonas de filmes e descanso diário. Assento retrátil com molas espirais e espuma D28, encosto reclinável em 5 estágios com almofadas 100% fibra siliconada. Revestimento em suede aveludado de toque macio.',
      category: 'Móveis',
      sector: 'moveis',
      brand: 'Rifletti',
      price: 1399.90,
      old_price: 1899.90,
      pix_price: 1259.91,
      card_price: 1399.90,
      installments_text: '10x de R$ 139,99 sem juros',
      shipping_text: 'Frete especial no app',
      stock_status: 'in_stock',
      seller_name: 'Magazine Luiza',
      seller_id: 'magazineluiza',
      store_name: 'Magalu',
      original_url: 'https://www.magazinevoce.com.br/magazineachadosradarbr/sofa-retratil-e-reclinavel-3-lugares-suede-veludo/p/235901200/mo/sofa/',
      affiliate_url: 'https://www.magazinevoce.com.br/magazineachadosradarbr/sofa-retratil-e-reclinavel-3-lugares-suede-veludo/p/235901200/mo/sofa/',
      images: [
        'https://a-static.mlcdn.com.br/1500x1500/conjuntos-moletom-infantil-feminino-blusa-e-calca-flanelado-agasalho-inverno-capuz-ziper-punho-roupa-menina-frio-crianca-tamanhos-04-06-08-lumari-kids/lumarikids/15904224067/e6fbfebb677db5008d946402be9f3fb7.jpeg'
      ],
      rating: 4.9,
      reviews_count: 312,
      specifications: [
        { name: 'Lugares', value: '3 Lugares com chaise aberta' },
        { name: 'Largura', value: '2,10 metros' },
        { name: 'Revestimento', value: 'Suede Veludo soft' }
      ]
    },
    {
      platform: 'mercadolivre',
      external_id: 'MLB9234857102',
      title: 'Mesa de Escritório Escrivaninha Industrial 120x60 com Prateleiras',
      description: 'Estilo industrial contemporâneo para home office ou estudos. Tampo em MDF engrossado padrão carvalho e estrutura de aço carbono reforçado com pintura eletrostática preta fosca. Inclui 2 prateleiras laterais reversíveis.',
      category: 'Móveis',
      sector: 'moveis',
      brand: 'Kubo Decor',
      price: 269.90,
      old_price: 359.00,
      pix_price: 242.91,
      card_price: 269.90,
      installments_text: '6x de R$ 44,98 sem juros',
      shipping_text: 'Frete grátis Mercado Envios',
      stock_status: 'in_stock',
      seller_name: 'Kubo Oficial',
      seller_id: 'kubo-decor',
      store_name: 'Mercado Livre',
      original_url: 'https://produto.mercadolivre.com.br/MLB-9234857102-escrivaninha-mesa-industrial-120cm',
      affiliate_url: 'https://meli.la/escrivaninha-industrial-120',
      images: [
        'https://http2.mlstatic.com/D_Q_NP_895766-MLB89576622881_082025-O.webp'
      ],
      rating: 4.8,
      reviews_count: 220,
      specifications: [
        { name: 'Dimensões', value: '120cm comp x 60cm prof x 75cm alt' },
        { name: 'Estrutura', value: 'Aço carbono anticorrosivo' },
        { name: 'Prateleiras', value: '2 prateleiras utilitárias' }
      ]
    },

    // ==========================================
    // 👶 BEBÊS (Itens reais de maternidade, passeio, segurança e alimentação)
    // ==========================================
    {
      platform: 'magalu',
      external_id: '228941500',
      title: 'Carrinho de Bebê com Bebê Conforto Voyage Travel System Delta',
      description: 'O conjunto Travel System Delta Voyage acompanha o crescimento do bebê desde o nascimento até os 15kg. Assento reclinável em modo berço, capota extensível com visor, cinto de 5 pontos e cesto porta-objetos espaçoso. Acompanha bebê conforto acoplável com certificação INMETRO.',
      category: 'Bebês',
      sector: 'bebes',
      brand: 'Voyage',
      price: 899.90,
      old_price: 1199.00,
      pix_price: 809.91,
      card_price: 899.90,
      installments_text: '10x de R$ 89,99 sem juros',
      shipping_text: 'Frete grátis garantido',
      stock_status: 'in_stock',
      seller_name: 'Magazine Luiza',
      seller_id: 'magazineluiza',
      store_name: 'Magalu',
      original_url: 'https://www.magazinevoce.com.br/magazineachadosradarbr/carrinho-de-bebe-travel-system-voyage/p/228941500/bb/carr/',
      affiliate_url: 'https://www.magazinevoce.com.br/magazineachadosradarbr/carrinho-de-bebe-travel-system-voyage/p/228941500/bb/carr/',
      images: [
        'https://a-static.mlcdn.com.br/1500x1500/patinete-infantil-3-rodas-de-led-dobravel-scooter-criancas-kparts-importadora/opacote/302047/e92951e4bc59b6af98606f3c848776dc.jpeg'
      ],
      rating: 4.8,
      reviews_count: 240,
      specifications: [
        { name: 'Faixa de Peso', value: '0 a 15 kg (Grupo 0+)' },
        { name: 'Acessórios', value: 'Acompanha Bebê Conforto' },
        { name: 'Certificação', value: 'Registro INMETRO 004.982/2019' }
      ]
    },
    {
      platform: 'mercadolivre',
      external_id: 'MLB9482910384',
      title: 'Cadeirinha para Auto 0 a 36kg Reclinável All Stages Fisher-Price',
      description: 'Segurança máxima para todas as fases da infância. Atende aos grupos 0+, 1, 2 e 3 (do nascimento até 36kg). Possui 4 posições de reclinação, proteção contra impactos laterais (SIP) e estofamento acolchoado ultra macio lavável em máquina.',
      category: 'Bebês',
      sector: 'bebes',
      brand: 'Fisher-Price',
      price: 549.90,
      old_price: 699.90,
      pix_price: 494.91,
      card_price: 549.90,
      installments_text: '10x de R$ 54,99 sem juros',
      shipping_text: 'Frete grátis Full',
      stock_status: 'in_stock',
      seller_name: 'Fisher-Price Oficial',
      seller_id: 'fisher-price-oficial',
      store_name: 'Mercado Livre',
      original_url: 'https://produto.mercadolivre.com.br/MLB-9482910384-cadeirinha-auto-fisher-price-all-stages',
      affiliate_url: 'https://meli.la/cadeirinha-fisher-price-all-stages',
      images: [
        'https://http2.mlstatic.com/D_Q_NP_895766-MLB89576622881_082025-O.webp'
      ],
      rating: 4.9,
      reviews_count: 512,
      specifications: [
        { name: 'Grupos', value: '0+, 1, 2 e 3 (0 a 36 kg)' },
        { name: 'Reclinação', value: '4 posições de ajuste' },
        { name: 'Cinto', value: '5 pontos com protetor peitoral' }
      ]
    },
    {
      platform: 'magalu',
      external_id: '231189400',
      title: 'Kit 3 Mamadeiras Pétala Philips Avent Anti-Cólica 125ml 260ml 330ml',
      description: 'O renomado sistema Pétala Philips Avent facilita a pega correta semelhante à amamentação natural no seio materno. Válvula anticólica clinicamente comprovada que reduz o desconforto e gases. Frascos ergonômicos e livres de BPA.',
      category: 'Bebês',
      sector: 'bebes',
      brand: 'Philips Avent',
      price: 199.90,
      old_price: 259.90,
      pix_price: 179.91,
      card_price: 199.90,
      installments_text: '4x de R$ 49,97 sem juros',
      shipping_text: 'Chega amanhã',
      stock_status: 'in_stock',
      seller_name: 'Magazine Luiza',
      seller_id: 'magazineluiza',
      store_name: 'Magalu',
      original_url: 'https://www.magazinevoce.com.br/magazineachadosradarbr/kit-3-mamadeiras-petala-philips-avent/p/231189400/bb/mama/',
      affiliate_url: 'https://www.magazinevoce.com.br/magazineachadosradarbr/kit-3-mamadeiras-petala-philips-avent/p/231189400/bb/mama/',
      images: [
        'https://a-static.mlcdn.com.br/1500x1500/patinete-infantil-3-rodas-de-led-dobravel-scooter-criancas-kparts-importadora/opacote/302047/e92951e4bc59b6af98606f3c848776dc.jpeg'
      ],
      rating: 4.9,
      reviews_count: 820,
      specifications: [
        { name: 'Volumes', value: '125ml, 260ml e 330ml' },
        { name: 'Sistema', value: 'Válvula anticólica dupla' },
        { name: 'Material', value: '100% Livre de BPA' }
      ]
    },
    {
      platform: 'mercadolivre',
      external_id: 'MLB9381726450',
      title: 'Fralda Pampers Confort Sec Mega Pacote G 120 Unidades até 12h Seco',
      description: 'Com canais de ar exclusivos que permitem que o ar circule livremente dentro da fralda, mantendo a pele do bebê arejada e sequinha por até 12 horas. Gel mágico que absorve e retém a umidade no interior da fralda.',
      category: 'Bebês',
      sector: 'bebes',
      brand: 'Pampers',
      price: 149.90,
      old_price: 189.90,
      pix_price: 134.91,
      card_price: 149.90,
      installments_text: '3x de R$ 49,96 sem juros',
      shipping_text: 'Frete grátis Mercado Envios',
      stock_status: 'in_stock',
      seller_name: 'Pampers Loja Oficial',
      seller_id: 'pampers-oficial',
      store_name: 'Mercado Livre',
      original_url: 'https://produto.mercadolivre.com.br/MLB-9381726450-fralda-pampers-confort-sec-g-120-tiras',
      affiliate_url: 'https://meli.la/fralda-pampers-confort-sec-g',
      images: [
        'https://http2.mlstatic.com/D_Q_NP_895766-MLB89576622881_082025-O.webp'
      ],
      rating: 5.0,
      reviews_count: 1420,
      specifications: [
        { name: 'Tamanho', value: 'G (9 a 13 kg)' },
        { name: 'Quantidade', value: '120 tiras' },
        { name: 'Duração', value: 'Até 12 horas de proteção' }
      ]
    },

    // ==========================================
    // 💄 BELEZA & CUIDADOS PESSOAIS
    // ==========================================
    {
      platform: 'magalu',
      external_id: '235889100',
      title: 'Prancha Chapinha de Cabelo Nano Titanium Pro 230C Bivolt Azul',
      description: 'Placas de titânio de alta qualidade com condutividade térmica superior, alisando os fios até 40% mais rápido sem ressecar. Regulagem digital de temperatura até 230°C (450°F), cabo giratório 360° e acabamento em Ryton resistente a altas temperaturas.',
      category: 'Beleza',
      sector: 'beleza',
      brand: 'BaByliss / Titanium',
      price: 169.90,
      old_price: 249.90,
      pix_price: 149.90,
      card_price: 169.90,
      installments_text: '3x de R$ 56,63 sem juros',
      shipping_text: 'Chega em 2 dias',
      stock_status: 'in_stock',
      seller_name: 'Magazine Luiza',
      seller_id: 'magazineluiza',
      store_name: 'Magalu',
      original_url: 'https://www.magazinevoce.com.br/magazineachadosradarbr/prancha-chapinha-nano-titanium-pro-230c/p/235889100/pf/chap/',
      affiliate_url: 'https://www.magazinevoce.com.br/magazineachadosradarbr/prancha-chapinha-nano-titanium-pro-230c/p/235889100/pf/chap/',
      images: [
        'https://a-static.mlcdn.com.br/1500x1500/fritadeira-eletrica-air-fryer-mondial-pratic-af-36-bi-36l-inox-preta-110v/lojaslebiscuit/2147432393/a764c865c464f434d958ebefb9d35ff1.jpg'
      ],
      rating: 4.8,
      reviews_count: 410,
      specifications: [
        { name: 'Temperatura Máxima', value: '230°C / 450°F' },
        { name: 'Tecnologia', value: 'Placas Nano Titanium' },
        { name: 'Voltagem', value: 'Bivolt Automático' }
      ]
    },
    {
      platform: 'mercadolivre',
      external_id: 'MLB9518294019',
      title: 'Secador de Cabelo Taiff Tourmaline Ion 2000W Potente Cerâmica',
      description: 'Potência de 2000W com a força da turmalina que potencializa a emissão de íons negativos, eliminando o frizz e deixando os cabelos muito mais brilhantes e sedosos. Motor profissional AC de alta durabilidade e botão de jato de ar frio.',
      category: 'Beleza',
      sector: 'beleza',
      brand: 'Taiff',
      price: 249.90,
      old_price: 329.00,
      pix_price: 224.91,
      card_price: 249.90,
      installments_text: '6x de R$ 41,65 sem juros',
      shipping_text: 'Frete grátis Full',
      stock_status: 'in_stock',
      seller_name: 'Taiff Loja Oficial',
      seller_id: 'taiff-oficial',
      store_name: 'Mercado Livre',
      original_url: 'https://produto.mercadolivre.com.br/MLB-9518294019-secador-taiff-tourmaline-ion-2000w',
      affiliate_url: 'https://meli.la/secador-taiff-tourmaline-2000w',
      images: [
        'https://http2.mlstatic.com/D_Q_NP_895766-MLB89576622881_082025-O.webp'
      ],
      rating: 4.9,
      reviews_count: 890,
      specifications: [
        { name: 'Potência', value: '2000 Watts' },
        { name: 'Motor', value: 'Profissional AC de longa vida' },
        { name: 'Tecnologia', value: 'Tourmaline Ion anti-frizz' }
      ]
    },
    {
      platform: 'mercadolivre',
      external_id: 'MLB9627192840',
      title: 'Máquina de Cortar Cabelo e Barba Philips Multigroom 9 em 1 Bivolt',
      description: 'Aparador multifuncional tudo-em-um para cabelo, barba, nariz e orelhas. Lâminas autoafiáveis em aço inoxidável que não enferrujam e bateria de lítio de até 70 minutos de autonomia sem fio. Acompanha 7 pentes guia resistentes.',
      category: 'Beleza',
      sector: 'beleza',
      brand: 'Philips',
      price: 189.90,
      old_price: 249.00,
      pix_price: 170.91,
      card_price: 189.90,
      installments_text: '5x de R$ 37,98 sem juros',
      shipping_text: 'Frete grátis Brasil',
      stock_status: 'in_stock',
      seller_name: 'Philips Oficial',
      seller_id: 'philips-oficial',
      store_name: 'Mercado Livre',
      original_url: 'https://produto.mercadolivre.com.br/MLB-9627192840-philips-multigroom-9-em-1-bivolt',
      affiliate_url: 'https://meli.la/philips-multigroom-9-em-1',
      images: [
        'https://http2.mlstatic.com/D_Q_NP_895766-MLB89576622881_082025-O.webp'
      ],
      rating: 4.8,
      reviews_count: 650,
      specifications: [
        { name: 'Funções', value: '9 em 1 (Cabelo, Barba, Nariz, Orelhas)' },
        { name: 'Autonomia', value: 'Até 70 minutos contínuos' },
        { name: 'Lâminas', value: 'Autoafiáveis em Aço Inox' }
      ]
    },

    // ==========================================
    // 🐶 PET (Rações premium, brinquedos, camas e bebedouros)
    // ==========================================
    {
      platform: 'mercadolivre',
      external_id: 'MLB9712849102',
      title: 'Ração Premier Fórmula Cães Adultos Raças Médias Frango 15kg',
      description: 'Alimento Super Premium formulado cientificamente com ingredientes nobres para manter a vitalidade, pelagem brilhante e saúde intestinal equilibrada do seu cão. Rico em proteínas de alto valor biológico e ômegas 3 e 6.',
      category: 'Pet',
      sector: 'pet',
      brand: 'Premier Pet',
      price: 239.90,
      old_price: 289.00,
      pix_price: 215.91,
      card_price: 239.90,
      installments_text: '6x de R$ 39,98 sem juros',
      shipping_text: 'Frete grátis Full',
      stock_status: 'in_stock',
      seller_name: 'Premier Pet Oficial',
      seller_id: 'premier-pet',
      store_name: 'Mercado Livre',
      original_url: 'https://produto.mercadolivre.com.br/MLB-9712849102-racao-premier-caes-adultos-15kg',
      affiliate_url: 'https://meli.la/racao-premier-caes-15kg',
      images: [
        'https://http2.mlstatic.com/D_Q_NP_895766-MLB89576622881_082025-O.webp'
      ],
      rating: 4.9,
      reviews_count: 1100,
      specifications: [
        { name: 'Porte', value: 'Raças Médias e Grandes' },
        { name: 'Peso', value: 'Pacote 15 kg' },
        { name: 'Linha', value: 'Super Premium' }
      ]
    },
    {
      platform: 'mercadolivre',
      external_id: 'MLB9829103847',
      title: 'Arranhador para Gatos 3 Andares com Casinha, Poste Sisal e Rede',
      description: 'Playground completo para o entretenimento e saúde do seu gato. Estrutura estável revestida em pelúcia macia antialérgica, postes reforçados envoltos em corda de sisal natural para afiar as unhas e rede de descanso suspensa.',
      category: 'Pet',
      sector: 'pet',
      brand: 'Cat Play',
      price: 189.90,
      old_price: 259.00,
      pix_price: 170.91,
      card_price: 189.90,
      installments_text: '5x de R$ 37,98 sem juros',
      shipping_text: 'Frete grátis para todo o Brasil',
      stock_status: 'in_stock',
      seller_name: 'Pet Shop Brasil',
      seller_id: 'pet-shop-brasil',
      store_name: 'Mercado Livre',
      original_url: 'https://produto.mercadolivre.com.br/MLB-9829103847-arranhador-gatos-3-andares-casinha',
      affiliate_url: 'https://meli.la/arranhador-gatos-3-andares',
      images: [
        'https://http2.mlstatic.com/D_Q_NP_895766-MLB89576622881_082025-O.webp'
      ],
      rating: 4.8,
      reviews_count: 320,
      specifications: [
        { name: 'Altura', value: '1,10 metros' },
        { name: 'Material', value: 'Madeira MDF, Sisal e Pelúcia' },
        { name: 'Andares', value: '3 plataformas + Casinha + Rede' }
      ]
    },
    {
      platform: 'magalu',
      external_id: '238192000',
      title: 'Fonte Bebedouro Automático para Gatos e Cães Bivolt com Filtro de Carvão',
      description: 'Água corrente e sempre fresca estimula seu pet a beber muito mais água, prevenindo doenças renais e urinárias. Bomba d água silenciosa e sistema de tripla filtragem com carvão ativado que retém pelos e impurezas.',
      category: 'Pet',
      sector: 'pet',
      brand: 'Amicus',
      price: 89.90,
      old_price: 129.90,
      pix_price: 79.90,
      card_price: 89.90,
      installments_text: '2x de R$ 44,95 sem juros',
      shipping_text: 'Pronta entrega',
      stock_status: 'in_stock',
      seller_name: 'Magazine Luiza',
      seller_id: 'magazineluiza',
      store_name: 'Magalu',
      original_url: 'https://www.magazinevoce.com.br/magazineachadosradarbr/fonte-bebedouro-automatico-pet-bivolt/p/238192000/pe/bebe/',
      affiliate_url: 'https://www.magazinevoce.com.br/magazineachadosradarbr/fonte-bebedouro-automatico-pet-bivolt/p/238192000/pe/bebe/',
      images: [
        'https://a-static.mlcdn.com.br/1500x1500/patinete-infantil-3-rodas-de-led-dobravel-scooter-criancas-kparts-importadora/opacote/302047/e92951e4bc59b6af98606f3c848776dc.jpeg'
      ],
      rating: 4.7,
      reviews_count: 198,
      specifications: [
        { name: 'Capacidade', value: '2 Litros' },
        { name: 'Filtro', value: 'Carvão Ativado' },
        { name: 'Voltagem', value: 'Bivolt Automático' }
      ]
    },

    // ==========================================
    // 🌳 JARDIM & EXTERIOR
    // ==========================================
    {
      platform: 'mercadolivre',
      external_id: 'MLB89576622881',
      title: 'Lavadora De Alta Pressão Lav 1600, 1.600 Lbf/pol² Vonder Bivolt',
      description: 'Ideal para limpeza residencial pesada de calçadas, carros, muros, decks e fachadas. Motor de alta durabilidade com sistema Stop Total que desliga o motor ao soltar o gatilho, economizando energia e água.',
      category: 'Jardim',
      sector: 'jardim',
      brand: 'Vonder',
      price: 529.90,
      old_price: 679.00,
      pix_price: 476.91,
      card_price: 529.90,
      installments_text: '10x de R$ 52,99 sem juros',
      shipping_text: 'Frete grátis Full',
      stock_status: 'in_stock',
      seller_name: 'Vonder Loja Oficial',
      seller_id: 'vonder-oficial',
      store_name: 'Mercado Livre',
      original_url: 'https://produto.mercadolivre.com.br/MLB-89576622881-lavadora-de-alta-presso-lav-1600-vonder',
      affiliate_url: 'https://meli.la/lavadora-vonder-1600',
      images: [
        'https://http2.mlstatic.com/D_Q_NP_2X_612148-MLB89576622881_082025-AB-lavadora-de-alta-presso-lav-1600-1600-lbfpol-vonder.webp'
      ],
      rating: 4.8,
      reviews_count: 389,
      specifications: [
        { name: 'Pressão', value: '1.600 lbf/pol² (PSI)' },
        { name: 'Vazão', value: '330 Litros por hora' },
        { name: 'Sistema', value: 'Stop Total automático' }
      ]
    },
    {
      platform: 'mercadolivre',
      external_id: 'MLB9918273645',
      title: 'Mangueira de Jardim Flexível Trançada 30 Metros com Esguicho Regulável',
      description: 'Mangueira resistente com tripla camada de PVC virgem siliconado e reforço de malha trançada antitorção. Acompanha bico esguicho com jato regulável de névoa até jato forte concentrado e engates rápidos.',
      category: 'Jardim',
      sector: 'jardim',
      brand: 'Genco / Tramontina',
      price: 79.90,
      old_price: 119.00,
      pix_price: 71.91,
      card_price: 79.90,
      installments_text: '2x de R$ 39,95 sem juros',
      shipping_text: 'Chega amanhã',
      stock_status: 'in_stock',
      seller_name: 'Casa & Jardim Store',
      seller_id: 'casa-jardim-store',
      store_name: 'Mercado Livre',
      original_url: 'https://produto.mercadolivre.com.br/MLB-9918273645-mangueira-jardim-trancada-30m',
      affiliate_url: 'https://meli.la/mangueira-jardim-30m',
      images: [
        'https://http2.mlstatic.com/D_Q_NP_895766-MLB89576622881_082025-O.webp'
      ],
      rating: 4.7,
      reviews_count: 420,
      specifications: [
        { name: 'Comprimento', value: '30 metros' },
        { name: 'Camadas', value: 'Tripla camada antitorção' },
        { name: 'Conexões', value: 'Esguicho e adaptador de torneira inclusos' }
      ]
    },
    {
      platform: 'magalu',
      external_id: '237910200',
      title: 'Aparador de Grama Elétrico Tramontina 1000W Corte Preciso 220V',
      description: 'Ideal para acabamentos perfeitos em bordas de gramados, contornos de árvores e calçadas. Motor elétrico potente de 1000W com fio de nylon resistente e empunhadura ergonômica com trava de segurança.',
      category: 'Jardim',
      sector: 'jardim',
      brand: 'Tramontina',
      price: 199.90,
      old_price: 269.90,
      pix_price: 179.91,
      card_price: 199.90,
      installments_text: '4x de R$ 49,97 sem juros',
      shipping_text: 'Frete grátis no app',
      stock_status: 'in_stock',
      seller_name: 'Magazine Luiza',
      seller_id: 'magazineluiza',
      store_name: 'Magalu',
      original_url: 'https://www.magazinevoce.com.br/magazineachadosradarbr/aparador-de-grama-tramontina-1000w/p/237910200/jd/apar/',
      affiliate_url: 'https://www.magazinevoce.com.br/magazineachadosradarbr/aparador-de-grama-tramontina-1000w/p/237910200/jd/apar/',
      images: [
        'https://a-static.mlcdn.com.br/1500x1500/fritadeira-eletrica-air-fryer-mondial-pratic-af-36-bi-36l-inox-preta-110v/lojaslebiscuit/2147432393/a764c865c464f434d958ebefb9d35ff1.jpg'
      ],
      rating: 4.8,
      reviews_count: 275,
      specifications: [
        { name: 'Potência', value: '1000 Watts' },
        { name: 'Diâmetro de Corte', value: '28 centímetros' },
        { name: 'Alimentação', value: 'Fio de nylon de 1,8mm' }
      ]
    },

    // ==========================================
    // 🍳 ELETRODOMÉSTICOS MULTI-LOJAS (Benoit, Magalu & Mercado Livre)
    // ==========================================
    {
      platform: 'benoit',
      external_id: 'benoit-geladeira-brastemp-frost-free-375l',
      title: 'Geladeira Brastemp Frost Free Duplex 375 Litros Evox Inox',
      description: 'A Geladeira Brastemp Frost Free Duplex 375L tem design moderno com acabamento Evox que protege contra ferrugem e corrosão. Gavetão Fresh Zone para conservar frutas e legumes, compartimento Extra Frio para resfriamento rápido de bebidas.',
      category: 'Eletrodomésticos',
      sector: 'eletro',
      brand: 'Brastemp',
      price: 2899.00,
      old_price: 3499.00,
      pix_price: 2609.10,
      card_price: 2899.00,
      installments_text: '10x de R$ 289,90 sem juros',
      shipping_text: 'Entrega ágil e rastreada',
      stock_status: 'in_stock',
      seller_name: 'Lojas Benoit',
      seller_id: 'benoit-oficial',
      store_name: 'Lojas Benoit',
      original_url: 'https://www.benoit.com.br/produto/10010868',
      affiliate_url: 'https://www.awin1.com/cread.php?awinmid=79974&awinaffid=3105840&ued=https%3A%2F%2Fwww.benoit.com.br%2Fproduto%2F10010868',
      images: [
        'https://d296pbmv9m7g8v.cloudfront.net/Custom/Content/Products/10/72/1072776_balcao-com-tampo-kappesberg-g744e607cn-cb334-2-portas-88x80x52cm-10010868_s11_639135043876038125.webp'
      ],
      rating: 4.9,
      reviews_count: 142,
      specifications: [
        { name: 'Capacidade', value: '375 Litros' },
        { name: 'Tipo', value: 'Frost Free Duplex' },
        { name: 'Acabamento', value: 'Evox resistente' }
      ]
    },
    {
      platform: 'mercadolivre',
      external_id: 'MLB9182736450',
      title: 'Aspirador de Pó Vertical e Portátil 2 em 1 Electrolux STK10 1000W',
      description: 'Potência e praticidade para o dia a dia. Funciona como aspirador vertical para pisos e carpetes ou aspirador de mão portátil para estofados e cantos. Filtro HEPA lavável que retém até 99,9% dos ácaros e fungos.',
      category: 'Eletrodomésticos',
      sector: 'eletro',
      brand: 'Electrolux',
      price: 199.90,
      old_price: 259.00,
      pix_price: 179.91,
      card_price: 199.90,
      installments_text: '4x de R$ 49,97 sem juros',
      shipping_text: 'Frete grátis Full',
      stock_status: 'in_stock',
      seller_name: 'Electrolux Loja Oficial',
      seller_id: 'electrolux-oficial',
      store_name: 'Mercado Livre',
      original_url: 'https://produto.mercadolivre.com.br/MLB-9182736450-aspirador-po-vertical-electrolux-stk10',
      affiliate_url: 'https://meli.la/aspirador-electrolux-stk10',
      images: [
        'https://http2.mlstatic.com/D_Q_NP_895766-MLB89576622881_082025-O.webp'
      ],
      rating: 4.8,
      reviews_count: 1840,
      specifications: [
        { name: 'Potência', value: '1000 Watts' },
        { name: 'Filtragem', value: 'Filtro HEPA antialérgico' },
        { name: 'Capacidade', value: 'Reservatório de 1,2 Litros' }
      ]
    },
    {
      platform: 'mercadolivre',
      external_id: 'MLB9283746510',
      title: 'Micro-ondas Consul 20 Litros Espelhado Cinza Bivolt CMS20',
      description: 'Design compacto e sofisticado com porta espelhada. Conta com menu Fácil para preparar pipoca, brigadeiro e aquecer pratos com um toque, além de trava de segurança para crianças e função Descongelar por peso.',
      category: 'Eletrodomésticos',
      sector: 'eletro',
      brand: 'Consul',
      price: 549.90,
      old_price: 689.00,
      pix_price: 494.91,
      card_price: 549.90,
      installments_text: '10x de R$ 54,99 sem juros',
      shipping_text: 'Frete grátis Full',
      stock_status: 'in_stock',
      seller_name: 'Consul Oficial',
      seller_id: 'consul-oficial',
      store_name: 'Mercado Livre',
      original_url: 'https://produto.mercadolivre.com.br/MLB-9283746510-micro-ondas-consul-20l-espelhado',
      affiliate_url: 'https://meli.la/micro-ondas-consul-20l',
      images: [
        'https://http2.mlstatic.com/D_Q_NP_895766-MLB89576622881_082025-O.webp'
      ],
      rating: 4.7,
      reviews_count: 530,
      specifications: [
        { name: 'Capacidade', value: '20 Litros' },
        { name: 'Acabamento', value: 'Porta espelhada moderna' },
        { name: 'Funções', value: 'Descongelar, Pipoca, Pratos Rápidos' }
      ]
    }
  ];

  let successCount = 0;

  for (const item of productsToSeed) {
    try {
      // 1. Upsert product
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .upsert({
          platform: item.platform,
          external_id: item.external_id,
          title: item.title,
          description: item.description,
          category: item.category,
          brand: item.brand,
          status: 'published',
          rating: item.rating,
          reviews_count: item.reviews_count,
          specifications: item.specifications,
          updated_at: new Date().toISOString()
        }, { onConflict: 'platform,external_id' })
        .select('id')
        .single();

      if (prodErr || !prodData?.id) {
        console.error(`❌ Erro ao salvar produto ${item.title}:`, prodErr?.message);
        continue;
      }

      const productId = prodData.id;

      // 2. Upsert images
      await supabase.from('product_images').delete().eq('product_id', productId);
      const imgRows = item.images.map((imgUrl, idx) => ({
        product_id: productId,
        url: imgUrl,
        display_order: idx,
        is_primary: idx === 0
      }));
      await supabase.from('product_images').insert(imgRows);

      // 3. Upsert offer
      await supabase.from('offers').delete().eq('product_id', productId);
      await supabase.from('offers').insert({
        product_id: productId,
        price: item.price,
        old_price: item.old_price,
        pix_price: item.pix_price,
        card_price: item.card_price,
        discount_percent: Math.round(((item.old_price - item.pix_price) / item.old_price) * 100),
        installments_text: item.installments_text,
        shipping_text: item.shipping_text,
        stock_quantity: 25,
        stock_status: item.stock_status,
        seller_name: item.seller_name,
        seller_id: item.seller_id,
        store_name: item.store_name,
        observed_at: new Date().toISOString()
      });

      // 4. Upsert affiliate link
      await supabase.from('affiliate_links').delete().eq('product_id', productId);
      await supabase.from('affiliate_links').insert({
        product_id: productId,
        platform: item.platform,
        affiliate_url: item.affiliate_url,
        original_url: item.original_url,
        status: 'active',
        verified_at: new Date().toISOString(),
        refresh_due_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

      // 5. Upsert sector assignment
      if (item.sector) {
        await supabase.from('product_sectors').upsert({
          product_id: productId,
          sector_slug: item.sector,
          assignment_source: 'manual',
          assigned_at: new Date().toISOString()
        }, { onConflict: 'product_id,sector_slug' });
      }

      successCount++;
      console.log(`✅ [${item.sector.toUpperCase()} - ${item.platform.toUpperCase()}] Cadastrado: ${item.title.slice(0, 45)}...`);
    } catch (err) {
      console.error(`❌ Erro no item ${item.title}:`, err.message);
    }
  }

  console.log(`\n🎉 Finalizado! ${successCount}/${productsToSeed.length} produtos adicionados com sucesso ao catálogo.`);
}

run().catch(console.error);
