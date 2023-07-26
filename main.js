$(function() {
    $('#pagament').on('click', function() {
        const presa = crea_presa();
        get_doc().collection('preses').doc().set(presa);        
        ompleDades();
    });
    $('#producte').on('change', function(ev) {
        let producte = ev.target.value;
        $('#cost').val('');
        $('#llista option').each(function() {
            const trossos = this.text.split(',');
            if (trossos[1] == producte) {
                $('#cost').val(trossos[2]);
            }
        });
        if (! $('#cost').val() ) {
            get_preses().reverse().forEach(presa => {
                presa.linies.forEach(linia => {
                    let apunt = get_apunt(linia);
                    if (apunt.producte == producte)
                        $('#cost').val(apunt.cost);
                });
            });
        }
        if (! $('#cost').val() ) {
            $('#cost').val('0');
        }
        valida_entrada();
    });
    $('#entra_canvia').on('click', function() {
        let nom = $('#nom').val();
        let producte = $('#producte').val();
        let cost = $('#cost').val();
        let canviat = false;
        $('#llista option').each(function() {
            const trossos = this.text.split(',');
            if (trossos[1] == producte) {
                this.text = trossos[0]+','+producte+','+cost;
            }
            if (nom == trossos[0]) {
                this.text = nom+','+producte+','+cost;
                canviat = true;
            }
        });
        if (! canviat) {
            $('#llista').append('<option>'+nom+','+producte+','+cost+'</option>');
            $('#llista_noms').append('<option>'+nom+'</option>');
        }
        omple_qui_paga();
    });
    $('#llista option').on('click', function(ev) {
        omple_qui_paga();
        let apunt = get_apunt(ev.target.text);
        $('#nom').val(apunt.nom);
        $('#producte').val(apunt.producte);
        $('#cost').val(''+apunt.cost);
    });
    $('#llista').on('change', function(ev) {
        omple_qui_paga();
    });
    $('#logout').on('click', function() {
        firebase.auth().signOut().then(() => {
            window.location.reload();
          }).catch((error) => {
            alert(error);
          });
    });
    $('.pestanya h4').on('click', function(ev) {
        let div_node = $(ev.target).parent();
        div_node.toggleClass('div_obert div_tancat');
    });
    $('#nom').on('keyup', function(ev) {
        valida_entrada();
    });
    $('#cost').on('keyup', function(ev) {
        valida_entrada();
    });
});

function valida_entrada() {
    if ($('#nom:invalid').length) {
        $('#entra_canvia').prop('disabled', true);
        return;
    }
    if ($('#producte').val().length == 0) {
        $('#entra_canvia').prop('disabled', true);
        return;
    }
    if ($('#cost').val().length == 0) {
        $('#entra_canvia').prop('disabled', true);
        return;
    }
    $('#entra_canvia').prop('disabled', false);
}

function get_doc() {
    var docId = window.location.search.substr(1);
    var hist = firebase.firestore().collection('hist');
    return hist.doc(docId);
}
function anula(presa_id) {
    get_doc().collection('preses').doc(presa_id).set({anula: $('#apuntador').text()}, { merge: true }).then(() => {
        ompleDades();
    });
}
function desanula(presa_id) {
    get_doc().collection('preses').doc(presa_id).set({anula: null}, { merge: true }).then(() => {
        ompleDades();
    });
}
function presa_html(presa_id, data) {
    var total = 0;
    data.linies.forEach(element => {
        let apunt = get_apunt(element);
        total += apunt.cost;
    });
    ret = '<li onclick="$(\'#dades_'+presa_id+'\').toggle()">';
    ret += data.dt;
    if (data.anula)
        ret += ' (anul·lat)';
    ret += ', Pagador <b>'+data.paga+'</b> <i>'+total+'</i>';
    ret += '<div style="display:none" id="dades_'+presa_id+'">';
    ret += 'Apunta: <b>' + data.apunta + '</b><br/>'; 
    if (data.anula)
        ret += 'Anul·la: <b>' + data.anula +'</b><br />';
    ret += data.linies.join('<br/>');
    ret += '<br />';
    if (data.anula)
        ret += '<button type="button" onclick="desanula(\''+presa_id+'\')">desanul·la</button>';
    else
        ret += '<button type="button" onclick="anula(\''+presa_id+'\')">anul·la</button>';
    ret += '</li>';
    return ret;
}
function ompleDades() {
    $('#dades').empty();
    $('#aplicacio').hide();
    $('#load').show();
    get_doc().collection('preses').orderBy('moment','desc').get().then((querySnapshot) => {
        var preses = [];
        querySnapshot.forEach((doc) => {
            var data = doc.data();
            const dt = (new Date(data.moment)); 
            data.dt = dt.toLocaleString('ca-CA',{
                datestyle: 'short',
                timestyle: 'short',
            });
            preses.push(data);
            $('#dades').append(presa_html(doc.id, data));
        });
        $('#dades').data('preses', preses);
        $('#aplicacio').show();
        $('#load').hide();
        window.balanços = get_balanços();
        omple_llista();
    });
}

function omple_qui_paga() {
    var partners = [];
    var deuria_mes = {};
    $('#llista option:selected').each(function() {
        let apunt = get_apunt(this.text);
        partners.push(apunt.nom);
        deuria_mes[apunt.nom] = -apunt.cost;
    });
    if (partners.length)
        $('#pagament').prop( "disabled", false );
    else
        $('#pagament').prop( "disabled", true );

    var suma_deutes = {};
    var baos = window.balanços;
    partners.forEach(pagaria => {
        suma_deutes[pagaria] = deuria_mes[pagaria];
        partners.forEach(pren => {
            const key = get_key(pagaria,pren);
            if (key in baos) {
                suma_deutes[pagaria] += baos[key];
            }
        })
    });

    var entries = Object.entries(suma_deutes);
    $('#qui_paga').empty();
    for (const [key, value] of entries.sort((a,b) => a[1] - b[1])) {
        $('#qui_paga').append('<option value="'+key+'">'+key+',('+value+')</option>');
    };
}

function crea_presa() {
    var linies = [];
    $('#llista option:selected').each(function() {
        linies.push(this.text);
    });
    return {
        moment: (new Date()).toISOString(),
        apunta: $('#apuntador').text(),
        paga: $('#qui_paga').val(),
        linies: linies,
    };
}
function get_preses() {
    return $('#dades').data('preses');
}

function omple_llista() {
    var items = {};
    get_preses().forEach(presa => {
        presa.linies.forEach(element => {
            let apunt = get_apunt(element);
            if (apunt.nom)
                items[apunt.nom] = element;
        });
    });
    $('#llista').empty();
    $('#llista_noms').empty();
    for (const [key, value] of Object.entries(items).sort()) {
        $('#llista').append('<option>'+value+'</option>');
        $('#llista_noms').append('<option>'+key+'</option>');
    }
    omple_qui_paga();
}

function get_apunt(linia) {
    ret = {};
    const parts = linia.split(',');
    ret.nom = parts[0];
    ret.producte = parts[1];
    ret.cost = parseFloat(parts[2]);
    return ret;
}

function get_key(paga, pren) {
    return paga + '->' + pren;
}
function get_balanços() {
    var baos = {};
    get_preses().forEach(presa => {
        if (! presa.anula)
            presa.linies.forEach(element => {
                let apunt = get_apunt(element);
                if (presa.paga != apunt.nom) {
                    const k1 = get_key(presa.paga, apunt.nom);
                    if (!(k1 in baos))
                        baos[k1] = 0;
                    baos[k1] += apunt.cost;
                    const k2 = get_key(apunt.nom, presa.paga);
                    if (!(k2 in baos))
                        baos[k2] = 0;
                    baos[k2] -= apunt.cost;
                }
            });
    });
    return baos;
}
