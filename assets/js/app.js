document.addEventListener('DOMContentLoaded', () => {
  const R = 8.314462618; // J/mol·K
  const P = 101325; // Pa (1 atm)
  const componentsDiv = document.getElementById('components');
  const addBtn = document.getElementById('add-component');
  const totalSpan = document.getElementById('total-percent');
  const calculateBtn = document.getElementById('calculate');

  function createComponentRow(defaults = {}){
    const div = document.createElement('div');
    div.className = 'component';
    div.innerHTML = `
      <input type="text" class="name" placeholder="Nom (ex: CH4)">
      <input type="number" class="percent" placeholder="% (mol)" min="0" step="0.01" value="${defaults.percent||0}">
      <input type="number" class="molarMass" placeholder="M (g/mol)" step="0.01" value="${defaults.molarMass||0}">
      C:<input type="number" class="nC" placeholder="C" min="0" step="1" value="${defaults.nC||0}" style="width:54px">
      H:<input type="number" class="nH" placeholder="H" min="0" step="1" value="${defaults.nH||0}" style="width:54px">
      O:<input type="number" class="nO" placeholder="O" min="0" step="1" value="${defaults.nO||0}" style="width:54px">
      N:<input type="number" class="nN" placeholder="N" min="0" step="1" value="${defaults.nN||0}" style="width:54px">
      LHV(kJ/mol):<input type="number" class="lhv" placeholder="kJ/mol" step="0.1" value="${defaults.lhv||0}" style="width:90px">
      <button class="remove">×</button>
    `;
    div.querySelector('.remove').addEventListener('click', ()=>{ div.remove(); updateTotal(); });
    div.querySelector('.percent').addEventListener('input', updateTotal);
    componentsDiv.appendChild(div);
  }

  function updateTotal(){
    const percents = Array.from(document.querySelectorAll('#components .percent')).map(i=>parseFloat(i.value)||0);
    const sum = percents.reduce((a,b)=>a+b,0);
    totalSpan.textContent = sum.toFixed(2);
  }

  addBtn.addEventListener('click',(e)=>{ e.preventDefault(); createComponentRow(); });

  // add a couple of helpful defaults
  createComponentRow({percent:50, molarMass:16.04, nC:1, nH:4, nO:0, lhv: 802.3}); // CH4 ~ 802.3 kJ/mol (approx)
  createComponentRow({percent:50, molarMass:28.01, nC:0, nH:0, nO:0, lhv:0}); // N2
  updateTotal();

  calculateBtn.addEventListener('click',(e)=>{
    e.preventDefault();
    const rows = Array.from(document.querySelectorAll('#components .component'));
    const data = rows.map(r=>({
      name: r.querySelector('.name').value || 'X',
      percent: parseFloat(r.querySelector('.percent').value)||0,
      molarMass: parseFloat(r.querySelector('.molarMass').value)||0,
      nC: parseFloat(r.querySelector('.nC').value)||0,
      nH: parseFloat(r.querySelector('.nH').value)||0,
      nO: parseFloat(r.querySelector('.nO').value)||0,
      nN: parseFloat(r.querySelector('.nN').value)||0,
      lhv: parseFloat(r.querySelector('.lhv').value)||0
    }));

    const totalPercent = data.reduce((s,d)=>s+d.percent,0);
    if(totalPercent<=0){ alert('Saisissez des pourcentages non nuls.'); return; }
    // normalize to mole fractions
    const xs = data.map(d=>d.percent/totalPercent);

    // mean molar mass (g/mol)
    const meanM = xs.reduce((s,x,i)=>s + x * (data[i].molarMass || 0),0);

    // choose reference temperature
    const T = parseFloat(document.querySelector('input[name="ref"]:checked').value) || 273.15;
    const molarVolume = R * T / P; // m3/mol

    // density kg/m3 = (M_mean kg/mol) / molarVolume
    const meanM_kg_per_mol = meanM / 1000;
    const density = meanM_kg_per_mol / molarVolume; // kg/m3

    // stoichiometry: O2 needed per mol fuel = sum x*(c + h/4 - o/2)
    const O2_needed = xs.reduce((s,x,i)=>s + x * (data[i].nC + data[i].nH/4 - data[i].nO/2),0);
    const air_mol = O2_needed / 0.21; // air mol per mol fuel (approx)

    const CO2_mol = xs.reduce((s,x,i)=>s + x * data[i].nC,0);
    const H2O_mol = xs.reduce((s,x,i)=>s + x * data[i].nH/2,0);

    const CO2_mass_kg = CO2_mol * 44.01 / 1000;
    const H2O_mass_kg = H2O_mol * 18.015 / 1000;

    const energy_per_mol = xs.reduce((s,x,i)=>s + x * (data[i].lhv || 0),0); // kJ/mol if lhv provided
    const energy_per_kg = meanM>0 ? energy_per_mol * 1000 / meanM : 0; // kJ/kg
    const energy_per_m3 = molarVolume>0 ? energy_per_mol / molarVolume : 0; // kJ/m3

    // display
    document.getElementById('mean-molar-mass').textContent = meanM>0 ? meanM.toFixed(3) + ' g·mol⁻¹' : '–';
    document.getElementById('density').textContent = isFinite(density) ? density.toFixed(3) + ' kg·m⁻³' : '–';

    const unit = document.getElementById('unit').value;
    let energyText = 'N/A (entrez LHV en kJ/mol pour chaque composant)';
    if(energy_per_mol>0){
      if(unit==='kg') energyText = energy_per_kg.toFixed(1) + ' kJ·kg⁻¹ (' + (energy_per_kg/3600).toFixed(3) + ' kWh·kg⁻¹)';
      else if(unit==='Nm3') energyText = energy_per_m3.toFixed(1) + ' kJ·m⁻³ (' + (energy_per_m3/3600).toFixed(4) + ' kWh·m⁻³)';
      else energyText = energy_per_mol.toFixed(1) + ' kJ·mol⁻¹';
    }
    document.getElementById('energy').textContent = energyText;

    document.getElementById('air').textContent = isFinite(air_mol) ? air_mol.toFixed(3) + ' mol air per mol mixture (≈ ' + (air_mol*28.97).toFixed(2) + ' g air per mol mixture)' : '–';
    document.getElementById('water').textContent = H2O_mol.toFixed(3) + ' mol H2O → ' + H2O_mass_kg.toFixed(3) + ' kg per mol mixture';
    document.getElementById('co2').textContent = CO2_mol.toFixed(3) + ' mol CO2 → ' + CO2_mass_kg.toFixed(3) + ' kg per mol mixture';

    document.getElementById('debug').textContent = JSON.stringify({
      normalized_mole_fractions: xs,
      mean_molar_mass_g_per_mol: meanM,
      density_kg_per_m3: density,
      molar_volume_m3_per_mol: molarVolume,
      O2_needed_mol_per_mol_fuel: O2_needed,
      air_mol_per_mol: air_mol,
      CO2_mol_per_mol: CO2_mol,
      H2O_mol_per_mol: H2O_mol,
      energy_kJ_per_mol: energy_per_mol,
      energy_kJ_per_kg: energy_per_kg
    }, null, 2);
  });

});
