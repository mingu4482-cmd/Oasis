package com.smu.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smu.backend.dto.SensorLogDTO;
import com.smu.backend.mapper.SensorLogMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeoulWaterLevelService {

    private final SensorLogMapper sensorLogMapper;
    private final ObjectMapper objectMapper;

    // 본인 인증키로 변경 필수!
    private final String SEOUL_API_KEY = "524f4144746a6864373267746f6658";

    // 일단 종로구("01")만 테스트
    private final String[] GU_CODES = {
            "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
            "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
            "21", "22", "23", "24", "25"
    };

    // 서버 시작 시 실행 + 10분마다 반복 실행
    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        log.info("🚀 서버 기동! 초기 데이터 수집 시작...");
        fetchSeoulWaterLevelData();
    }

    @Scheduled(fixedRate = 600000)
    public void scheduledFetch() {
        log.info("⏰ 10분 주기 스케줄러 실행...");
        fetchSeoulWaterLevelData();
    }
    public void fetchSeoulWaterLevelData() {
        log.info(">>>> 🌊 서울시 하수관로 수위 데이터 수집 시작!");

        LocalDateTime now = LocalDateTime.now();
        String currentHour = now.format(DateTimeFormatter.ofPattern("yyyyMMddHH"));
        String lastHour = now.minusHours(24).format(DateTimeFormatter.ofPattern("yyyyMMddHH")); // 24시간 범위로 확대
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        RestClient restClient = RestClient.create();
        int totalSaved = 0;

        for (String guCode : GU_CODES) {
            try {
                String url = String.format("http://openapi.seoul.go.kr:8088/%s/json/DrainpipeMonitoringInfo/1/1000/%s/%s/%s",
                        SEOUL_API_KEY, guCode, lastHour, currentHour);

                String responseBody = restClient.get()
                        .uri(url)
                        .exchange((request, response) ->
                                new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8)
                        );

                // 🔍 원본 응답 로그 확인
                log.info("🔍 서울시 API 응답 데이터: {}", responseBody);

                JsonNode rootNode = objectMapper.readTree(responseBody);

                if (rootNode.has("RESULT")) {
                    log.warn("🚨 API 에러 응답: {}", rootNode.path("RESULT").path("MESSAGE").asText());
                    continue;
                }

                JsonNode drainageNode = rootNode.path("DrainpipeMonitoringInfo");
                if (drainageNode.isMissingNode()) continue;

                JsonNode rowNode = drainageNode.path("row");
                List<SensorLogDTO> logsToInsert = new ArrayList<>();

                for (JsonNode node : rowNode) {
                    try {
                        String dateStr = node.path("MSRMT_YMD").asText();
                        if (dateStr.isEmpty()) continue;

                        if(dateStr.endsWith(".0")) dateStr = dateStr.substring(0, dateStr.length() - 2);

                        SensorLogDTO dto = new SensorLogDTO();
                        String unqNo = node.path("UNQ_NO").asText().replace("-", "");
                        dto.setLocationId(Long.parseLong(unqNo));
                        dto.setName(node.path("PSTN_INFO").asText());
                        double waterLevelMeter = node.path("MSRMT_WATL").asDouble();
                        int waterLevelCm = (int) Math.round(waterLevelMeter * 100);
                        if (waterLevelCm < 0) {
                            log.warn("⚠️ 비정상 센서 데이터 감지! 수위가 {}cm 입니다. 저장을 건너뜁니다. (Location: {})",
                                    waterLevelCm, dto.getName());
                            continue; // 아래 저장 로직을 실행하지 않고 다음 데이터로 넘어감!
                        }

                        dto.setWaterLevel(waterLevelCm);
                        dto.setMeasuredAt(LocalDateTime.parse(dateStr, formatter));

                        logsToInsert.add(dto);
                    } catch (Exception e) {
                        log.warn("개별 데이터 파싱 실패: {}", e.getMessage());
                    }
                }

                if (logsToInsert != null && !logsToInsert.isEmpty()) {
                    for (SensorLogDTO logDto : logsToInsert) {
                        try {
                            // 🌟 핵심: locations 테이블에 이 ID가 있는지 확인
                            boolean exists = sensorLogMapper.existsLocation(logDto.getLocationId());

                            if (!exists) {
                                // 만약 없으면, 일단 빈 정보라도 locations 테이블에 강제로 추가!
                                log.info("🆕 새로운 센서 발견! 위치 정보 자동 등록: {}", logDto.getLocationId());
                                sensorLogMapper.insertLocation(logDto.getLocationId(), logDto.getName());
                            }

                            // 이제는 저장해도 외래 키 에러 안 남!
                            sensorLogMapper.insertSensorLog(logDto);
                            totalSaved++;
                        } catch (Exception dbError) {
                            log.error("💥 DB 저장 실패: {}", dbError.getMessage());
                        }
                    }
                } else {
                    log.info("ℹ️ 저장할 데이터가 없습니다.");
                }

            } catch (Exception e) {
                log.error("❌ 구 코드 [{}] 통신 에러: {}", guCode, e.getMessage());
            }
        }
        log.info("<<<< ✅ 수집 완료! 총 {} 건의 데이터가 처리되었습니다.", totalSaved);
    }
}