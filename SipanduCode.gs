/**
 * SIPANDU — SipanduCode.gs
 * Router utama Web App SIPANDU. Deploy TERPISAH dari Web App Portal
 * Relawan -- URL-nya beda, disimpan di frontend sebagai SIPANDU_API_URL
 * (§27: "Jangan menulis URL Apps Script di banyak file").
 */

function doGet(e) {
  try {
    const action = e.parameter.action;
    let data;

    switch (action) {
      case 'getSipanduProfilSaya':
        data = getSipanduProfilSaya(e.parameter.token);
        break;
      case 'getSipanduDashboard':
        data = getSipanduDashboard(e.parameter.token);
        break;
      case 'getWorkOrderList':
        data = getWorkOrderList(e.parameter.token, e.parameter);
        break;
      case 'getWorkOrderDetail':
        data = getWorkOrderDetail(e.parameter.token, e.parameter.id);
        break;
      case 'getMenuList':
        data = getMenuList(e.parameter.token);
        break;
      case 'getBeneficiaryList':
        data = getBeneficiaryList(e.parameter.token, e.parameter.idWo);
        break;
      case 'getPreparationList':
        data = getPreparationList(e.parameter.token, e.parameter.idWo);
        break;
      case 'getProcessingList':
        data = getProcessingList(e.parameter.token, e.parameter.idWo);
        break;
      case 'getPortioningList':
        data = getPortioningList(e.parameter.token, e.parameter.idWo);
        break;
      case 'getDistributionList':
        data = getDistributionList(e.parameter.token, e.parameter.idWo);
        break;
      case 'getWashingList':
        data = getWashingList(e.parameter.token, e.parameter.idWo);
        break;
      case 'getValidationStatus':
        data = getValidationStatus(e.parameter.token, e.parameter.idWo);
        break;
      case 'getLatestSnapshot':
        data = getLatestSnapshot(e.parameter.token, e.parameter.idWo);
        break;
      case 'getDaftarRelawanUntukHakAkses':
        data = getDaftarRelawanUntukHakAkses(e.parameter.token);
        break;
      case 'getDaftarRoleSipandu':
        data = getDaftarRoleSipandu(e.parameter.token);
        break;
      default:
        return sipanduGagal('Aksi tidak dikenali: ' + action, 'UNKNOWN_ACTION');
    }
    return sipanduSukses(data);
  } catch (err) {
    return sipanduGagal(err.message || 'Terjadi kesalahan pada server.', sipanduKlasifikasiError_(err));
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    let data;

    switch (action) {
      case 'addWorkOrder':
        data = addWorkOrder(body);
        break;
      case 'updateWorkOrder':
        data = updateWorkOrder(body);
        break;
      case 'advanceWorkOrderStatus':
        data = advanceWorkOrderStatus(body);
        break;
      case 'addBeneficiary':
        data = addBeneficiary(body);
        break;
      case 'addMenu':
        data = addMenu(body);
        break;
      case 'setMenuGizi':
        data = setMenuGizi(body);
        break;
      case 'addPreparationItem':
        data = addPreparationItem(body);
        break;
      case 'updatePreparationItem':
        data = updatePreparationItem(body);
        break;
      case 'addProcessingItem':
        data = addProcessingItem(body);
        break;
      case 'updateProcessingItem':
        data = updateProcessingItem(body);
        break;
      case 'addPortioningSesi':
        data = addPortioningSesi(body);
        break;
      case 'updatePortioningSesi':
        data = updatePortioningSesi(body);
        break;
      case 'addDistributionRoute':
        data = addDistributionRoute(body);
        break;
      case 'addDistributionStop':
        data = addDistributionStop(body);
        break;
      case 'catatPengirimanBerangkat':
        data = catatPengirimanBerangkat(body);
        break;
      case 'catatPengirimanSampai':
        data = catatPengirimanSampai(body);
        break;
      case 'jadwalkanPengambilan':
        data = jadwalkanPengambilan(body);
        break;
      case 'catatPengambilanBerangkat':
        data = catatPengambilanBerangkat(body);
        break;
      case 'catatOmprengKembali':
        data = catatOmprengKembali(body);
        break;
      case 'addWashingRecord':
        data = addWashingRecord(body);
        break;
      case 'mulaiPencucian':
        data = mulaiPencucian(body);
        break;
      case 'selesaikanPencucian':
        data = selesaikanPencucian(body);
        break;
      case 'setValidationChecklist':
        data = setValidationChecklist(body);
        break;
      case 'generateAutoFillPOP':
        data = generateAutoFillPOP(body);
        break;
      case 'generatePOP':
        data = generatePOP(body);
        break;
      case 'setSipanduUserRole':
        data = setSipanduUserRole(body);
        break;
      case 'cabutSipanduUserRole':
        data = cabutSipanduUserRole(body);
        break;
      default:
        return sipanduGagal('Aksi tidak dikenali: ' + action, 'UNKNOWN_ACTION');
    }
    return sipanduSukses(data);
  } catch (err) {
    return sipanduGagal(err.message || 'Terjadi kesalahan pada server.', sipanduKlasifikasiError_(err));
  }
}
