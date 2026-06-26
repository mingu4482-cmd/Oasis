package com.smu.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Slf4j
@Service
public class KakaoGeoService {

    // 🌟 아까 복사한 카카오 REST API 키를 여기에 붙여넣기!
    private final String KAKAO_REST_API_KEY = "c820787a3c6dd400a475ae15a8446435";

    private final ObjectMapper objectMapper = new ObjectMapper();

    // 텍스트 주소를 넣으면 [위도, 경도] 배열을 뱉어내는 마법의 메서드!
    public double[] getCoordinates(String address) {
        try {
            RestClient restClient = RestClient.create();

            // 맨홀 주소에 특수기호나 잡음이 많아서 주소검색보단 키워드검색이 더 잘 찾아냄
            String url = "https://dapi.kakao.com/v2/local/search/keyword.json?query=" + address;

            String response = restClient.get()
                    .uri(url)
                    .header("Authorization", "KakaoAK " + KAKAO_REST_API_KEY) // 카카오 인증 헤더
                    .retrieve()
                    .body(String.class);

            JsonNode rootNode = objectMapper.readTree(response);
            JsonNode documents = rootNode.path("documents");

            // 검색 결과가 1개라도 있으면 제일 첫 번째 결과의 좌표를 가져옴
            if (documents.isArray() && documents.size() > 0) {
                JsonNode firstResult = documents.get(0);
                double lon = firstResult.path("x").asDouble(); // 카카오는 x가 경도(Longitude)
                double lat = firstResult.path("y").asDouble(); // 카카오는 y가 위도(Latitude)
                return new double[]{lat, lon};
            }
        } catch (Exception e) {
            log.warn("❌ 좌표 변환 실패 (주소: {}): {}", address, e.getMessage());
        }

        return null; // 검색 결과가 없거나 에러 나면 null 리턴
    }
}