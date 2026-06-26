package com.smu.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.ResponseEntity;
import java.util.Map;
import java.util.HashMap;

@Service
public class SwmmService {

    // 파이썬 FastAPI 서버 주소
    private final String PYTHON_SWMM_URL = "http://localhost:8000/run-swmm";
    private final RestTemplate restTemplate = new RestTemplate();

    public Object runSimulation(double rainfall) {
        try {
            // 1. 파이썬으로 보낼 데이터 세팅 (JSON 형태: {"rainfall": 100.0})
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("rainfall", rainfall);

            // 2. 파이썬 서버로 POST 요청 쏘기
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    PYTHON_SWMM_URL,
                    requestBody,
                    Map.class
            );

            // 3. 파이썬이 계산해서 돌려준 결과(Map) 반환
            return response.getBody();

        } catch (Exception e) {
            System.out.println("🚨 파이썬 서버 연결 실패: " + e.getMessage());
            return null;
        }
    }
}