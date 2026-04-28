import requests
import json
import sys
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import base64
from flask import Flask, request, jsonify
from collections import OrderedDict

REG_AUTH_TOKEN = "YmQzNDVkYzcxNGI1ODRlNzQyMGQzYTcwYTM5YWY5Njg6aXJSWTlLQjJqcnEyZ0FreWluenUrQT09"

KEYS = {
    "VEHICLE_DETAILS": b"eECHALLAN@JSON$#",
    "SECRET_KEY": b"E@CHALLAN*#2015!",
    "MPARIVAHAN": b"E@CHALLAN*#2016!",
    "KEY_ECHALLAN": b"E@CHALLAN*#2017!",
    "RECEIPT": b"E@CHALLAN*#2017$",
    "ARCHIVE": b"_2017@ZIP$#\x00\x00\x00\x00\x00",
}

FIELD_ORDER = OrderedDict([
    ("stautsMessage", "status_message"),
    ("rc_regn_no", "registration_number"),
    ("rc_regn_dt", "registration_date"),
    ("rc_regn_upto", "registration_valid_until"),
    ("rc_owner_sr", "owner_serial_number"),
    ("rc_owner_name", "owner_name"),
    ("rc_f_name", "father_name"),
    ("state_cd", "state_code"),
    ("rto_cd", "rto_code"),
    ("rc_present_address", "present_address"),
    ("rc_permanent_address","permanent_address"),
    ("rc_mobile_no", "mobile_number"),
    ("rc_vch_catg", "vehicle_category"),
    ("rc_owner_cd", "owner_type_code"),
    ("rc_vh_class_desc", "vehicle_class_description"),
    ("rc_vhclass_desc", "vehicle_class"),
    ("rc_chasi_no", "chassis_number"),
    ("rc_eng_no", "engine_number"),
    ("rc_maker_desc", "manufacturer_name"),
    ("rc_maker_model", "model_name"),
    ("rc_body_type_desc", "body_type"),
    ("rc_fuel_desc", "fuel_type"),
    ("rc_color", "color"),
    ("rc_norms_desc", "emission_norms"),
    ("rc_fit_upto", "fitness_valid_until"),
    ("rc_tax_upto", "tax_valid_until"),
    ("rc_financer", "financer_name"),
    ("rc_insurance_comp", "insurance_company"),
    ("rc_insurance_policy_no", "insurance_policy_number"),
    ("rc_insurance_upto", "insurance_valid_until"),
    ("rc_manu_month_yr", "manufacturing_month_year"),
    ("rc_unld_wt", "unladen_weight_kg"),
    ("rc_gvw", "gross_vehicle_weight_kg"),
    ("rc_no_cyl", "number_of_cylinders"),
    ("rc_cubic_cap", "engine_capacity_cc"),
    ("rc_seat_cap", "seating_capacity"),
    ("rc_sleeper_cap", "sleeper_capacity"),
    ("rc_stand_cap", "standing_capacity"),
    ("rc_wheelbase", "wheelbase_mm"),
    ("rc_registered_at", "registered_at_location"),
    ("rc_status_as_on", "status_as_on_date"),
    ("rc_pucc_upto", "pucc_valid_until"),
    ("rc_pucc_no", "pucc_certificate_number"),
    ("rc_status", "vehicle_status"),
    ("rc_blacklist_status", "blacklist_status"),
    ("rc_noc_details", "noc_details"),
    ("rc_vh_class", "vehicle_class_code"),
    ("rc_fuel_cd", "fuel_code"),
    ("rc_maker_cd", "manufacturer_code"),
    ("rc_norms_cd", "norms_code"),
    ("rc_sale_amt", "sale_amount"),
    ("rc_vehicle_surrendered_to_dealer", "surrendered_to_dealer"),
    ("rc_currentadd_statename", "current_address_state_name"),
    ("rc_currentadd_districtcode","current_address_district_code"),
    ("rc_currentadd_pincode", "current_address_pincode"),
    ("rc_non_use", "non_use_status"),
    ("rc_tax_mode", "tax_mode"),
    ("rc_gcw", "gross_combination_weight"),
    ("API", "api_source"),
    ("pollution_cert_validity", "pollution_certificate_valid_until"),
    ("pollution_cert_no", "pollution_certificate_number"),
    ("timestamp", "response_timestamp")
])

def decrypt(encrypted_b64, key):
    cipher = AES.new(key, AES.MODE_ECB)
    raw = base64.b64decode(encrypted_b64)
    decrypted = unpad(cipher.decrypt(raw), AES.block_size)
    return decrypted.decode('utf-8')

def try_all_keys(encrypted_b64):
    for name, key in KEYS.items():
        try:
            return decrypt(encrypted_b64, key), name
        except Exception:
            continue
    return None, None

def rename_fields(parsed_dict):
    renamed = OrderedDict()
    for old_key, new_key in FIELD_ORDER.items():
        if old_key in parsed_dict:
            renamed[new_key] = parsed_dict[old_key]
    renamed.pop("api_source", None)
    return renamed

def fetch_vehicle_data(reg_no):
    value = reg_no.strip().upper()
    auth_token = REG_AUTH_TOKEN
    url = "https://echallan.parivahan.gov.in/api/get-rc-offence-info"
    headers = {
        "Auth-Token": auth_token,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Language": "en-US",
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 14; RMX3561 Build/UKQ1.230924.001)",
        "Host": "echallan.parivahan.gov.in",
        "Connection": "Keep-Alive",
    }
    payload = {
        "reg_no": value,
        "device_user_id": "6030",
        "user_id": "41515",
        "token": "d6b35024c544f77908c6461a8416633d",
        "IMEI": "000000000000000",
        "state_code": "TN",
        "user_type": "CPU_DEPARTMENT",
        "is_traffic": 1,
        "mode": 1,
        "api_mode": "live",
        "is_chassis": 0
    }
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=24)
        r.raise_for_status()
        data = r.json()
        if "result" not in data or "vehicle_details" not in data["result"]:
            return None
        encrypted = data["result"]["vehicle_details"].strip()
        plaintext, used_key = try_all_keys(encrypted)
        if not plaintext:
            return None
        parsed = json.loads(plaintext)
        return parsed
    except Exception:
        return None

app = Flask(__name__)

@app.route('/vehicle', methods=['GET'])
def get_vehicle():
    vno = request.args.get('vno')
    if not vno:
        return jsonify({
            "error": "Provide ?vno= parameter"
        }), 400
    data = fetch_vehicle_data(reg_no=vno)
    if not data:
        return jsonify({
            "error": "Could not fetch vehicle data (backend error or invalid number)"
        }), 200
    ordered = rename_fields(data)
    return jsonify(ordered), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)