use super::{expanded_stats, weapon_common_data::WeaponCommonData, WeaponName};

#[test]
fn published_white_values_enter_weapon_common_data_before_attack_calculation() {
    let cases = [
        (WeaponName::PrizedIsshinBlade, 510.0),
        (WeaponName::AthameArtis, 608.0),
        (WeaponName::MoonweaverDawn, 565.0),
        (WeaponName::SerenitysCall, 454.0),
        (WeaponName::LightbearingMoonshard, 542.0),
        (WeaponName::WhitelakeFrostfeather, 674.0),
        (WeaponName::ExaiphanesBlade, 608.0),
        (WeaponName::AmberBead, 401.0),
        (WeaponName::NightweaversLookingGlass, 542.0),
        (WeaponName::ReliquaryOfTruth, 542.0),
        (WeaponName::DawningFrost, 510.0),
        (WeaponName::EtherlightSpindlelute, 510.0),
        (WeaponName::BlackmarrowLantern, 454.0),
        (WeaponName::NocturnesCurtainCall, 542.0),
        (WeaponName::AngelosHeptades, 741.0),
    ];
    for (name, expected) in cases {
        assert_eq!(WeaponCommonData::new(name, 90, false, 1).base_atk, expected, "{name:?}");
        assert!(expanded_stats::stats(name, 1, false).is_some(), "{name:?} at level 1");
    }
    assert_eq!(WeaponCommonData::new(WeaponName::AthameArtis, 20, false, 1).base_atk, 122.0);
    assert_eq!(WeaponCommonData::new(WeaponName::AthameArtis, 20, true, 1).base_atk, 153.0);
    assert_eq!(WeaponCommonData::new(WeaponName::AthameArtis, 89, false, 1).base_atk, 604.0);
    assert_eq!(expanded_stats::stats(WeaponName::AthameArtis, 90, false).unwrap().1, 0.3308);
}
