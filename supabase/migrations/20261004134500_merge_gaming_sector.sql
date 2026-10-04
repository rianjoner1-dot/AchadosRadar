BEGIN;
CREATE OR REPLACE FUNCTION public.classify_catalog_sectors(p_title TEXT,p_category TEXT)
RETURNS TABLE(sector_slug TEXT,assignment_source TEXT)
LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path=public AS $$
 WITH input AS (SELECT public.normalize_catalog_text(p_title) AS title_text,public.normalize_catalog_text(p_category) AS category_text),
 rules(sector_slug,pattern) AS (VALUES
 ('eletronicos','\m(eletron|smartphone|celular|fone|bluetooth|televis|notebook|laptop|computador|tablet|monitor|teclado|mouse|camera|impressora|roteador|webcam|headset|hardware|placa de video|gpu|caixa de som|gamer|gaming|gabinete|processador|cpu|ssd|nvme|ddr3|ddr4|ddr5|memoria ram|fonte atx)\M'),
 ('moda','\m(roupa|vestido|blusa|camisa|camiseta|calca|shorts|short|saia|moda|bolsa|tenis|sapato|sandalia|jaqueta|blazer|lingerie|meia)\M'),
 ('moveis','\m(moveis|sofa|rack|cama|mesa|guarda roupa|estante|cadeira|escrivaninha|armario|poltrona)\M'),
 ('eletro','\m(eletrodomestico|eletroportatil|air fryer|airfryer|fritadeira|geladeira|fogao|microondas|liquidificador|cafeteira|batedeira|sanduicheira|mixer|ventilador|ar condicionado|lava louca|lavadora|maquina de lavar|ferro de passar)\M'),
 ('jardim','\m(jardim|jardinagem|planta|vaso|mangueira|piscina|churrasqueira|ferramenta de jardim|gramado)\M'),
 ('bebes','\m(bebe|bebes|infantil|carrinho de bebe|cadeirinha|berco|fralda|mamadeira|chupeta|banheira infantil)\M'),
 ('beleza','\m(beleza|perfume|secador|chapinha|skincare|maquiagem|hidratante|cosmetico|shampoo|modelador de cabelo)\M'),
 ('pet','\m(pet|racao|gato|cachorro|arranhador|tapete higienico|coleira|brinquedo pet|areia sanitaria)\M'),
 ('casa','\m(casa|cozinha|limpeza|organizador|aspirador|decoracao|utensilio|panela|toalha|travesseiro|tapete|roupa de cama|lampada|utilidades domesticas)\M'))
 SELECT r.sector_slug,CASE WHEN i.category_text ~ r.pattern THEN 'category' ELSE 'title' END
 FROM rules r CROSS JOIN input i WHERE i.category_text ~ r.pattern OR i.title_text ~ r.pattern;
$$;
INSERT INTO public.product_sectors(product_id,sector_slug,assignment_source)
 SELECT product_id,'eletronicos',assignment_source FROM public.product_sectors WHERE sector_slug='pc-gamer'
 ON CONFLICT(product_id,sector_slug) DO NOTHING;
DELETE FROM public.product_sectors WHERE sector_slug='pc-gamer';
DELETE FROM public.catalog_sectors WHERE slug='pc-gamer';
NOTIFY pgrst,'reload schema';
COMMIT;
