import assert from "node:assert/strict";
import test from "node:test";
import { CAMPUS_BUILDINGS, isBuildingMapQuestion, lookupCampusBuilding } from "./erica-campus-map";

test("campus map building numbers are unique", () => {
  assert.equal(new Set(CAMPUS_BUILDINGS.map((building) => building.number)).size, CAMPUS_BUILDINGS.length);
});

test("looks up buildings by name and common alias", () => {
  assert.equal(lookupCampusBuilding("융합교육관 건물번호")?.number, "317");
  assert.equal(lookupCampusBuilding("4공학관은 몇 번 건물이야?")?.number, "304");
  assert.equal(lookupCampusBuilding("학연산클러스터 어디야?")?.number, "311");
  assert.equal(lookupCampusBuilding("국제문화관 번호")?.number, "202");
});

test("looks up building name by map number", () => {
  assert.equal(lookupCampusBuilding("317번 건물 이름")?.name, "융합교육관");
  assert.equal(lookupCampusBuilding("건물번호 301")?.name, "제1공학관");
  assert.equal(lookupCampusBuilding("C03번 건물")?.name, "한국생산기술연구원");
  assert.equal(lookupCampusBuilding("999번 건물"), null);
});

test("room and phone numbers are not treated as building numbers", () => {
  assert.equal(isBuildingMapQuestion("융합교육관 301호 어디야?"), false);
  assert.equal(isBuildingMapQuestion("학생회관 전화번호"), false);
  assert.equal(isBuildingMapQuestion("융합교육관은 몇 번 건물이야?"), true);
  assert.equal(lookupCampusBuilding("융합교육관 301호 어디야?")?.number, "317");
});
