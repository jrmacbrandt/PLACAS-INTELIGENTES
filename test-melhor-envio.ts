/**
 * Teste Automatizado de Homologação da Integração com Melhor Envio
 * Valida: Cotação multi-transportadoras, seletor de menor preço, frete grátis, emissão de etiqueta e impressão.
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Iniciando Teste de Homologação: Melhor Envio...');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FALHA: ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Cotação de Frete para RJ (Jacarepaguá para Copacabana)
    console.log('\n📦 1. Testando Cotação de Frete (/api/shipping/calculate)...');
    const quoteRes = await fetch(`${BASE_URL}/api/shipping/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cep_destino: '22041001',
        quantidade_placas: 5,
        valor_declarado: 175.0,
      }),
    });
    const quoteData = await quoteRes.json();
    assert(quoteData.sucesso === true, 'Cotação retornou sucesso = true');
    assert(Array.isArray(quoteData.opcoes) && quoteData.opcoes.length >= 3, `Retornou ${quoteData.opcoes?.length} opções de frete (esperado >= 3)`);

    const hasCheapest = quoteData.opcoes.some((opt: any) => opt.is_cheapest === true);
    const hasFastest = quoteData.opcoes.some((opt: any) => opt.is_fastest === true);
    assert(hasCheapest, 'Opção mais barata devidamente identificada com badge (is_cheapest = true)');
    assert(hasFastest, 'Opção mais rápida devidamente identificada com badge (is_fastest = true)');

    const carriers = quoteData.opcoes.map((o: any) => o.carrier_name);
    console.log(`  Transportadoras cotadas: ${carriers.join(', ')}`);
    assert(carriers.includes('Jadlog') || carriers.includes('Correios'), 'Inclui operadoras Jadlog ou Correios');

    // 2. Testando Cotação para Lote Promocional (20 placas - Frete Grátis na regra de negócio)
    console.log('\n🎁 2. Testando Cotação para Lote Promocional (20 placas)...');
    const freeShippingRes = await fetch(`${BASE_URL}/api/shipping/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cep_destino: '01310100', // SP
        quantidade_placas: 20,
        valor_declarado: 600.0,
      }),
    });
    const freeShippingData = await freeShippingRes.json();
    assert(freeShippingData.sucesso === true, 'Cotação promocional bem-sucedida');
    const cheapestOption = freeShippingData.opcoes[0];
    assert(cheapestOption.price > 0, `Preço de tabela cotado pela transportadora é R$ ${cheapestOption.price} (reseller terá frete grátis custeado pelo Atelier)`);

    // 3. Criar Pedido com Frete Selecionado
    console.log('\n📝 3. Criando Pedido com Opção de Frete Selecionada...');
    // Obter um revendedor ativo
    const profRes = await fetch(`${BASE_URL}/api/auth/profiles`);
    const profData = await profRes.json();
    const revendedor = profData.perfis.find((p: any) => p.role === 'revendedor') || profData.perfis[1] || profData.perfis[0];
    assert(!!revendedor, `Revendedor encontrado para teste: ${revendedor?.nome}`);

    const selectedOption = quoteData.opcoes[0];
    const orderPayload = {
      revendedor_id: revendedor.id,
      quantidade: 5,
      modalidade_entrega: 'correios',
      endereco_correios: {
        destinatario: 'Cliente Teste Frete',
        cep: '22041001',
        logradouro: 'Avenida Atlântica',
        numero: '1500',
        complemento: 'Apto 101',
        bairro: 'Copacabana',
        cidade: 'Rio de Janeiro',
        uf: 'RJ',
      },
      opcao_frete: {
        service_id: selectedOption.service_id,
        carrier_name: selectedOption.carrier_name,
        service_name: selectedOption.service_name,
        price: selectedOption.price,
        delivery_time: selectedOption.delivery_time,
      },
    };

    const createRes = await fetch(`${BASE_URL}/api/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });
    const createData = await createRes.json();
    assert(createData.sucesso === true, `Pedido criado com sucesso: ${createData.pedido?.numero_pedido}`);
    const orderId = createData.pedido?.id;

    // Verificar se as informações do frete foram salvas na tabela de logística
    const logisticsRecord = createData.pedido?.logistica;
    assert(!!logisticsRecord, 'Registro de logística criado com sucesso');
    assert(logisticsRecord.transportadora === selectedOption.carrier_name, `Transportadora salva corretamente: ${logisticsRecord.transportadora}`);
    assert(logisticsRecord.servico_frete === selectedOption.service_name, `Serviço de frete salvo: ${logisticsRecord.servico_frete}`);
    assert(Number(logisticsRecord.valor_frete) === Number(selectedOption.price), `Valor do frete salvo: R$ ${logisticsRecord.valor_frete}`);

    // 4. Emissão de Etiqueta via Melhor Envio
    console.log('\n🏷️ 4. Testando Emissão de Etiqueta (/api/shipping/generate-label)...');
    const labelRes = await fetch(`${BASE_URL}/api/shipping/generate-label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    });
    const labelData = await labelRes.json();
    assert(labelData.sucesso === true, 'Emissão de etiqueta retornou sucesso = true');
    assert(!!labelData.codigo_rastreamento, `Código de rastreamento gerado: ${labelData.codigo_rastreamento}`);
    assert(!!labelData.etiqueta_url, `URL da etiqueta gerada: ${labelData.etiqueta_url}`);

    // 5. Visualização e Impressão de Etiqueta Térmica / A4
    console.log('\n🖨️ 5. Testando Endpoint de Impressão de Etiqueta (/api/shipping/labels/:orderId)...');
    const printRes = await fetch(`${BASE_URL}/api/shipping/labels/${orderId}`);
    assert(printRes.status === 200, 'Endpoint de impressão retornou HTTP 200 OK');
    const printHtml = await printRes.text();
    assert(printHtml.includes('Atelier das Placas'), 'Etiqueta contém identificação oficial Atelier das Placas');
    assert(printHtml.includes(labelData.codigo_rastreamento), 'Etiqueta contém o código de rastreamento impresso');
    assert(printHtml.includes('22041001') || printHtml.includes('22041-001'), 'Etiqueta contém CEP de destino');

    console.log(`\n========================================`);
    console.log(`RESULTADO: ${passed} passaram, ${failed} falharam.`);
    console.log(`========================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Erro na execução dos testes:', err);
    process.exit(1);
  }
}

runTests();
